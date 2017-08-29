/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2014  Arnel A. Borja <kyoushuu@yahoo.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


const cheerio = require('cheerio');
const cron = require('cron');
const {URLSearchParams} = require('url');

const ChannelCommand = require('./channel-command');

const MotivatedCitizen = require('../models/motivated-citizen');

const motivateLock = {};
const motivateDate = {};


class MotivateCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'motivate', {
      params: [{name: 'find', required: false, default: 5, parser: parseInt}],
      options: [
        ['w', 'weapon', 'Use q1 weapons'],
        ['f', 'food', 'Use q3 foods (default)'],
        ['g', 'gift', 'Use q3 gifts'],
        ['c', 'no-cache', 'Don\'t use cache'],
        ['m', 'message', 'Send links as private message'],
        ['n', 'notify', 'Send links as notice (default)'],
      ],
      requireCountryChannelType: 'motivation',
    });
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
    await country.populate('server organizations').execPopulate();

    if (motivateLock[server.name] &&
        Date.now() - motivateLock[server.name].date < 120000 &&
        motivateLock[server.name].nick !== from) {
      if (motivateLock[server.name].done) {
        const elapsedTime = Date.now() - motivateLock[server.name].date;
        const remainingTime = 2 * 60 - elapsedTime / 1000;
        throw new Error(
            'Command is locked in given server. Someone else used the command ' +
            'less than two minutes ago. Please try again after ' +
            `${remainingTime.toFixed(2)} seconds.`);
      } else {
        throw new Error(
            'Command is currently in use and therefore locked in given server. ' +
            'Please wait 2 minutes after the current user is done.');
      }
    }

    motivateLock[server.name] = {
      date: Date.now(),
      nick: from,
      done: false,
    };

    if (!motivateDate[from]) {
      motivateDate[from] = {};
    }

    if (Date.now() - motivateDate[from][server.name] < 12 * 60 * 60 * 1000 &&
        argv.length < 1) {
      this.bot.say(
          to,
          'WARNING: You last used this command less than 12 hours ago. You are ' +
          'allowed to use this command once per server per day only. Abusers ' +
          'will be banned in this channel. Please ignore this warning if you ' +
          'last used this command before the last day change.');
    }
    motivateDate[from][server.name] = Date.now();

    const notify = options.message;

    const pack =
      options.weapon ? 'weapon' :
      options.food ? 'food' :
      options.gift ? 'gift' :
      'food';

    const {find} = params;
    if (!isFinite(find) || find < 1) {
      throw new Error('Invalid find argument.');
    }

    if (country.organizations.length === 0) {
      throw new Error('No organizations registered for country.');
    }

    if (options['no-cache']) {
      this.bot.say(
          to,
          'WARNING: Use of no-cache option without permission is prohibited.');
    }

    this.bot.say(
        to,
        'Looking for new citizens that can be motivated in ' +
        `${server.name} server...`);

    if (notify) {
      this.bot.say(
          to,
          'Links will show up in notices/network tab, use -m option to show ' +
          'links as private message');
    } else {
      this.bot.say(
          to,
          'Links will show up as private message, use -n option to show links ' +
          'as notice');
    }

    this.bot.say(to, 'Need help? Run \u0002!motivate --help\u0002');


    const [organization] = country.organizations;
    const cache = !options['no-cache'];


    const [request] = await organization.createRequest();
    let $ = await request({
      uri: `${country.server.address}/newCitizens.html`,
      transform: (body) => cheerio.load(body),
      qs: {
        countryId: 0,
      },
    });

    const lastPageLink = $('ul#pagination-digg li:nth-last-child(2) a');
    if (!lastPageLink.length) {
      throw new Error('Failed to parse motivate page.');
    }

    const lastPage = parseInt(new URLSearchParams(
        lastPageLink.attr('href').split('?')[1]).get('page'));

    let found = 0;

    for (let page = lastPage; page > 0 && found < find; page--) {
      this.bot.say(to, `Checking page ${page}...`);
      motivateLock[server.name].date = Date.now();

      $ = await request({
        uri: `${country.server.address}/newCitizens.html`,
        transform: (body) => cheerio.load(body),
        qs: {
          countryId: 0,
          page,
        },
      });

      const citizens = [];
      $('table.dataTable tr td:first-child a').each((i, elem) => {
        citizens.push(parseInt(elem.attribs['href'].split('=')[1]));
      });

      for (const citizenId of citizens) {
        let citizen = null;

        if (cache) {
          citizen = await MotivatedCitizen.findOne({
            citizenId,
            server: country.server,
          });

          if (!citizen) {
            citizen = new MotivatedCitizen({
              citizenId,
              server: country.server,
              weapon: true,
              food: true,
              gift: true,
            });
          }

          if (!citizen[pack]) {
            continue;
          }
        }

        $ = await request({
          uri: `${country.server.address}/motivateCitizen.html`,
          transform: (body) => cheerio.load(body),
          qs: {
            id: citizenId,
          },
        });

        if (citizen) {
          if ($('input[value=1]').length === 0 && citizen.weapon) {
            citizen.weapon = false;
          }

          if ($('input[value=2]').length === 0 && citizen.food) {
            citizen.food = false;
          }

          if ($('input[value=3]').length === 0 && citizen.gift) {
            citizen.gift = false;
          }

          if (citizen.isModified()) {
            await citizen.save();
          }
        }

        const packId =
          pack === 'weapon' ? 1 :
          pack === 'food' ? 2 :
          pack === 'gift' ? 3 :
          2;

        if ($(`input[value=${packId}]`).length) {
          const motivateUrl =
            `${country.server.address}/motivateCitizen.html?id=${citizenId}`;

          if (notify) {
            this.bot.notice(from, `Found ${motivateUrl}`);
          } else {
            this.bot.say(from, `Found ${motivateUrl}`);
          }

          this.bot.say(to, 'Found a citizen to motivate');
          motivateLock[server.name].date = Date.now();

          found++;
        }

        if (found >= find) {
          break;
        }
      }
    }

    this.bot.say(to, `Done. Found ${found} citizen/s.`);
    if (found < find) {
      this.bot.say(
          to,
          'Not enough citizens found. You may re-run the ' +
          'command with another product but set ' +
          '\u0002find\u0002 argument to the number of citizens ' +
          'you need. Example: \u0002!motivate 2\u0002 to look ' +
          'for two citizens.');
    }

    motivateLock[server.name].date = Date.now();
    motivateLock[server.name].done = true;
  }
}


module.exports = MotivateCommand;


const cleanJob = new cron.CronJob('00 00 00 * * *', () => {
  MotivatedCitizen.remove((error) => {
    if (!error) {
      console.log('Successfully cleared cache with a cron job.');
    } else {
      console.log(`Failed to clear cache with a cron job: ${error}`);
    }
  });
}, () => {
  console.log('Cron job for clearing motivate cache stops');
}, false, 'Europe/Warsaw');
cleanJob.start();
