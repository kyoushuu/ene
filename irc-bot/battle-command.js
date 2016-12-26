/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2015  Arnel A. Borja <kyoushuu@yahoo.com>
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


const irc = require('irc');
const codes = irc.colors.codes;
const numeral = require('numeral');

const parse = require('./parse');

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = function(bot, from, to, argv) {
  parse(bot, '!battle (id)', [
    ['d', 'defender', 'Defender side (default)'],
    ['a', 'attacker', 'Attacker side'],
  ], argv, 1, 1, to, true, (error, args) => {
    if (error) {
      bot.say(to, `Error: ${error}`);
      return;
    } else if (!args) {
      return;
    }

    const query = Channel.findOne({name: to}).populate({
      path: 'countries',
      match: {server: args.server._id},
    });
    query.exec((error, channel) => {
      if (error) {
        bot.say(to, `Error: ${error}`);
        return;
      } else if (!channel) {
        bot.say(to, 'Channel not registered in database.');
        return;
      } else if (!channel.countries.length) {
        bot.say(to, 'Channel not registered for given server.');
        return;
      }

      User.findOne({
        nicknames: from,
      }, (error, user) => {
        if (error) {
          bot.say(to,
              `Failed to find user via nickname: ${error}`);
          return;
        }

        if (!user) {
          bot.say(to, 'Nickname is not registered.');
          return;
        }

        const countries = [];

        const l = channel.countries.length;
        for (let i = 0; i < l; i++) {
          if (channel.countries[i].getUserAccessLevel(user) > 0) {
            countries.push(channel.countries[i]);
          }
        }

        if (!countries.length) {
          bot.say(to, 'Permission denied.');
          return;
        } else if (countries.length > 1) {
          bot.say(to, 'Failed, you have access on multiple countries.');
          return;
        }

        const query = countries[0].populate('server');
        query.populate('organizations', (error, country) => {
          let j = -1;
          const l = country.channels.length;
          for (let i = 0; i < l; i++) {
            if (country.channels[i].channel.equals(channel.id)) {
              j = i;
            }
          }

          if (j < 0 ||
              !country.channels[j].types.includes('military')) {
            bot.say(to,
                'Military commands are not allowed for the given server in ' +
                'this channel.');
            return;
          }

          battleParse_(error, bot, from, to, args, country, user);
        });
      });
    });
  });
};

function battleParse_(error, bot, from, to, args, country, user) {
  if (error || !args) {
    return;
  }

  const opt = args.opt;

  const side =
    opt.options.defender ? 'defender' :
    opt.options.attacker ? 'attacker' :
    'defender';

  const battleId = parseInt(opt.argv[0]);
  if (isNaN(battleId) || battleId < 1) {
    bot.say(to, 'Invalid battle id');
    return;
  }

  battleShow(country, country.organizations[0], {
    battleId: battleId,
    side: side,
  }, (error, result) => {
    if (!error) {
      bot.say(to, result);
    } else {
      bot.say(to, `Failed to show battle: ${error}`);
    }
  });
}

function battleShow(country, organization, options, callback) {
  organization.getBattleInfo(options.battleId, (error, battleInfo) => {
    if (error) {
      callback(error);
      return;
    }

    organization.getBattleRoundInfo(battleInfo.roundId,
      (error, battleRoundInfo) => {
        if (error) {
          callback(error);
          return;
        }

        const defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
        const attackerScore = numeral().unformat(battleRoundInfo.attackerScore);
        const totalScore = defenderScore + attackerScore;

        const side = options.side;
        let wall = 0;
        let percentage = 0;

        if (side === 'defender') {
          wall = defenderScore - attackerScore;
          percentage = defenderScore / totalScore;
        } else if (side === 'attacker') {
          wall = attackerScore - defenderScore;
          percentage = attackerScore / totalScore;
        }

        if (!isFinite(percentage)) {
          percentage = 0;
        }

        const time = Math.max(0, battleRoundInfo.remainingTimeInSeconds);

        const ul = codes.underline;
        const bold = codes.bold;
        const reset = codes.reset;

        /* jshint camelcase: false */
        /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
        const dr = codes.dark_red;
        const dg = codes.dark_green;
        const or = codes.orange;
        /* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */
        /* jshint camelcase: true */

        const defSide = side === 'defender';
        const rnd = battleInfo.round;
        const winning = percentage > 0.5;

        const def = battleInfo.defender;
        const defWins = battleInfo.defenderWins;
        const atk = battleInfo.attacker;
        const atkWins = battleInfo.attackerWins;

        callback(null,
            `${country.server.address}/battle.html?id=${options.battleId} | ` +
            `${ul}${bold}${battleInfo.label}${reset} ` +
            `(${defSide ? def : atk}) - ` +
            `${bold}R${rnd}${reset} ` +
            `(${defSide ? dg : dr}${bold}${defWins}${reset}:` +
            `${defSide ? dr : dg}${bold}${atkWins}${reset}) | ` +
            `${bold}${winning ? `${dg}Winning` : `${dr}Losing`}${reset}: ` +
            `${numeral(percentage).format('0.00%')} | ` +
            `${bold}Wall: ${winning ? dg : dr}` +
            `${numeral(wall).format('+0,0')}${reset} | ` +
            `${bold}Time: ${reset}0${numeral(time).format('00:00:00')}`);
      });
  });
}
