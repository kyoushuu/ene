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

const parse = require('./parse');

const Channel = require('../models/channel');
const MotivatedCitizen = require('../models/motivated-citizen');

const motivateLock = {};
const motivateDate = {};


module.exports = function(bot, from, to, argv) {
  parse(bot, '!motivate [find=5]', [
    ['w', 'weapon', 'Use q1 weapons'],
    ['f', 'food', 'Use q3 foods (default)'],
    ['g', 'gift', 'Use q3 gifts'],
    ['c', 'no-cache', 'Don\'t use cache'],
    ['m', 'message', 'Send links as private message'],
    ['n', 'notify', 'Send links as notice (default)'],
  ], argv, 0, 1, to, true, function(error, args) {
    if (error) {
      bot.say(to, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    const query = Channel.findOne({name: to}).populate({
      path: 'countries',
      match: {server: args.server._id},
    });
    query.exec(function(error, channel) {
      if (error) {
        bot.say(to, 'Error: ' + error);
        return;
      } else if (!channel) {
        bot.say(to, 'Channel not registered in database.');
        return;
      } else if (!channel.countries.length) {
        bot.say(to, 'Channel not registered for given server.');
        return;
      }

      const query = channel.countries[0].populate('server');
      query.populate('organizations', function(error, country) {
        let j = -1;
        const l = country.channels.length;
        for (let i = 0; i < l; i++) {
          if (country.channels[i].channel.equals(channel.id)) {
            j = i;
          }
        }

        if (j < 0 ||
            !country.channels[j].types.includes('motivation')) {
          bot.say(to,
              'Motivate command not allowed for server in this ' +
              'channel.');
          return;
        }

        if (country.server.disabled) {
          bot.say(to, 'Server has been disabled.');
          return;
        }

        motivateParse_(error, bot, from, to, args, country);
      });
    });
  });
};

function motivateParse_(error, bot, from, to, args, country) {
  if (error || !args) {
    return;
  }

  const server = args.server;
  const opt = args.opt;

  if (motivateLock[server.name] &&
      Date.now() - motivateLock[server.name].date < 120000 &&
      motivateLock[server.name].nick !== from) {
    if (motivateLock[server.name].done) {
      const elapsedTime = Date.now() - motivateLock[server.name].date;
      const remainingTime = (2 * 60) - (elapsedTime / 1000);
      bot.say(to,
          'Command is locked in given server. Someone else used ' +
          'the command less than two minutes ago. Please try again ' +
          'after ' + remainingTime.toFixed(2) + ' seconds.');
      return;
    } else {
      bot.say(to,
          'Command is currently in use and therefore locked in ' +
          'given server. Please wait 2 minutes after the current ' +
          'user is done.');
      return;
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
      opt.argv.length < 1) {
    bot.say(to,
        'WARNING: You last used this command less than 12 hours ago. ' +
                'You are allowed to use this command once per server per day ' +
                'only. Abusers will be banned in this channel. Please ignore ' +
                'this warning if you last used this command before the last ' +
                'day change.');
  }
  motivateDate[from][server.name] = Date.now();

  const notify = opt.options.message;

  const pack =
    opt.options.weapon ? 'weapon' :
    opt.options.food ? 'food' :
    opt.options.gift ? 'gift' :
    'food';

  const find = opt.argv.length === 1 ? parseInt(opt.argv[0]) : 5;
  if (!isFinite(opt.argv[0]) || find < 1) {
    bot.say(to, 'Invalid find argument.');
    return;
  }

  if (country.organizations.length === 0) {
    bot.say(to, 'No organizations registered for country.');
    return;
  }

  if (opt.options['no-cache']) {
    bot.say(to,
        'WARNING: Use of no-cache option without permission is ' +
                'prohibited.');
  }

  bot.say(to,
      'Looking for new citizens that can be motivated in ' + server.name +
      ' server...');

  if (notify) {
    bot.say(to,
        'Links will show up in notices/network tab, use -m option to ' +
                'show links as private message');
  } else {
    bot.say(to,
        'Links will show up as private message, use -n option to ' +
                'show links as notice');
  }

  bot.say(to, 'Need help? Run \u0002!motivate --help\u0002 or ask kyoushuu');

  motivate(country, country.organizations[0], {
    pack: pack,
    find: find,
    cache: !opt.options['no-cache'],
  }, function(error, found) {
    if (!error) {
      bot.say(to, 'Done. Found ' + found + ' citizen/s.');
      if (found < find) {
        bot.say(to,
            'Not enough citizens found. You may re-run the ' +
            'command with another product but set ' +
                        '\u0002find\u0002 argument to the number of citizens ' +
                        'you need. Example: \u0002!motivate 2\u0002 to look ' +
                        'for two citizens.');
      }
    } else {
      bot.say(to, 'Failed to find citizens to motivate: ' + error);
    }
    motivateLock[server.name].date = Date.now();
    motivateLock[server.name].done = true;
  }, function(page) {
    bot.say(to, 'Checking page ' + page + '...');
    motivateLock[server.name].date = Date.now();
  }, function(motivateUrl) {
    if (notify) {
      bot.notice(from, 'Found ' + motivateUrl);
    } else {
      bot.say(from, 'Found ' + motivateUrl);
    }
    bot.say(to, 'Found a citizen to motivate');
    motivateLock[server.name].date = Date.now();
  });
}

function motivate(
        country, organization, options,
        callback, pageCallback, foundCallback) {
  organization.createRequest(function(error, request, jar) {
    const url = country.server.address + '/newCitizens.html?countryId=0';
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);

        if (!$('a#userName').length) {
          organization.login(function(error) {
            if (!error) {
              motivate(country, organization, options,
                  callback, pageCallback, foundCallback);
            } else {
              callback('Failed to get motivate page: ' + error);
            }
          });
          return;
        }

        let page = $('ul#pagination li:nth-last-child(2) a');
        if (page.length) {
          page = parseInt(page.text());
          motivateCheckPage_(
              country, organization, options, request, 0, page,
              callback, pageCallback, foundCallback);
        } else {
          callback('Failed to parse motivate page.');
        }
      } else {
        callback('Failed to get motivate page: ' +
            (error || 'HTTP Error: ' + response.statusCode));
      }
    });
  });
}

function motivateCheckPage_(
        country, organization, options, request, found, page,
        callback, pageCallback, foundCallback) {
  pageCallback(page);

  const url = country.server.address +
            '/newCitizens.html?countryId=0&page=' + page;
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      const $ = cheerio.load(body);

      if (!$('a#userName').length) {
        organization.login(function(error) {
          if (!error) {
            motivateCheckPage_(
                country, organization, options, request,
                found, page,
                callback, pageCallback, foundCallback);
          } else {
            callback('Failed to check page: ' + error);
          }
        });
        return;
      }

      const citizens = [];
      $('table.sortedTable tbody tr td:first-child a').each(function(i, elem) {
        citizens.push(parseInt($(this).attr('href').split('=')[1]));
      });
      motivateCheckCitizen_(
          country, organization, options, request,
          found, page, citizens, 0,
          callback, pageCallback, foundCallback);
    } else {
      callback('Failed to check page: ' +
          (error || 'HTTP Error: ' + response.statusCode));
    }
  });
}

function motivateCheckCitizen_(
        country, organization, options, request, found, page, citizens, i,
        callback, pageCallback, foundCallback) {
  if (options.cache) {
    motivateCheckCitizenFromCache_(
        country, organization, options, request,
        found, page, citizens, i,
        callback, pageCallback, foundCallback);
  } else {
    motivateCheckCitizenFromServer_(
        country, organization, options, request,
        found, page, citizens, i, null,
        callback, pageCallback, foundCallback);
  }
}

function motivateCheckCitizenFromCache_(
        country, organization, options, request, found, page, citizens, i,
        callback, pageCallback, foundCallback) {
  MotivatedCitizen.findOne({
    citizenId: citizens[i],
    server: country.server,
  }, function(error, citizen) {
    if (error) {
      console.log(error);
    }

    if (!citizen) {
      citizen = new MotivatedCitizen({
        citizenId: citizens[i],
        server: country.server,
        weapon: true,
        food: true,
        gift: true,
      });
    }

    if (citizen[options.pack]) {
      motivateCheckCitizenFromServer_(
          country, organization, options, request,
          found, page, citizens, i, citizen,
          callback, pageCallback, foundCallback);
      return;
    }

    motivateCheckNextCitizen_(
        country, organization, options, request,
        found, page, citizens, i,
        callback, pageCallback, foundCallback);
  });
}

function motivateCheckCitizenFromServer_(
        country, organization, options, request,
        found, page, citizens, i, citizen,
        callback, pageCallback, foundCallback) {
  const url = country.server.address +
            '/motivateCitizen.html?id=' + citizens[i];
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      const $ = cheerio.load(body);

      if (!$('a#userName').length) {
        organization.login(function(error) {
          if (!error) {
            motivateCheckCitizenFromServer_(
                country, organization, options, request,
                found, page, citizens, i, citizen,
                callback, pageCallback, foundCallback);
          } else {
            callback('Failed to check citizen: ' + error);
          }
        });
        return;
      }

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
          citizen.save(function(error) {
            if (error) {
              console.log(error);
            }
          });
        }
      }

      const pack =
        options.pack === 'weapon' ? 1 :
        options.pack === 'food' ? 2 :
        options.pack === 'gift' ? 3 :
        2;

      if ($('input[value=' + pack + ']').length) {
        const motivateUrl = country.server.address +
            '/motivateCitizen.html?id=' + citizens[i];
        foundCallback(motivateUrl);
        found++;
      }

      motivateCheckNextCitizen_(
          country, organization, options, request,
          found, page, citizens, i,
          callback, pageCallback, foundCallback);
    } else {
      callback('Failed to check citizen: ' +
          (error || 'HTTP Error: ' + response.statusCode));
    }
  });
}

function motivateCheckNextCitizen_(
        country, organization, options, request,
        found, page, citizens, i,
        callback, pageCallback, foundCallback) {
  if (found < options.find) {
    if (++i < citizens.length) {
      motivateCheckCitizen_(
          country, organization, options, request,
          found, page, citizens, i,
          callback, pageCallback, foundCallback);
    } else if (page > 1) {
      --page;
      motivateCheckPage_(
          country, organization, options, request, found, page,
          callback, pageCallback, foundCallback);
    } else {
      callback(null, found);
    }
  } else {
    callback(null, found);
  }
}

const cleanJob = new cron.CronJob('00 00 00 * * *', function() {
  MotivatedCitizen.remove(function(error) {
    if (!error) {
      console.log('Successfully cleared cache with a cron job.');
    } else {
      console.log('Failed to clear cache with a cron job: ' + error);
    }
  });
}, function() {
  console.log('Cron job for clearing motivate cache stops');
}, false, 'Europe/Warsaw');
cleanJob.start();
