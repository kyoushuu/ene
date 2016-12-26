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
const Battle = require('../models/battle');

const call = require('./call-command');

const watchpoints = {
  full: [
    6000, 4800, 3600,
    3000, 2400, 1800,
    1500, 1200, 900, 600, 300,
    270, 240, 210, 180, 150, 120,
    105, 90, 75, 60,
    50, 40, 30,
    24, 18, 12, 6, 0,
    -6, -12,
  ],
  light: [
    600, 300, 120, -12,
  ],
};
const watchlist = {};


module.exports = function(bot, from, to, argv) {
  parse(bot, '!watch [battle id]', [
    ['d', 'defender', 'Defender side (default)'],
    ['a', 'attacker', 'Attacker side'],
    ['L', 'list', 'List battles in watchlist (default)'],
    ['w', 'watch', 'Add battle to watchlist (default if battle id is given)'],
    ['l', 'light', 'Show status on T-10, T-5 and T-2 only'],
    ['f', 'full', 'Show status on all intervals (default)'],
    ['r', 'remove', 'Remove battle from watchlist (battle id required)'],
  ], argv, 0, 1, to, true, function(error, args) {
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
    query.exec(function(error, channel) {
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
      }, function(error, user) {
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
        query.populate('organizations', function(error, country) {
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

          watchParse_(error, bot, from, to, args, country, channel);
        });
      });
    });
  });
};

function watchParse_(error, bot, from, to, args, country, channel) {
  if (error || !args) {
    return;
  }

  const opt = args.opt;

  const side =
    opt.options.defender ? 'defender' :
    opt.options.attacker ? 'attacker' :
    'defender';

  const mode =
    opt.options.light ? 'light' :
    opt.options.full ? 'full' :
    'full';

  const battleId =
    !opt.options.list && opt.argv.length > 0 ? parseInt(opt.argv[0]) : 0;
  if (isNaN(battleId) || battleId < 1) {
    bot.say(to, 'Invalid battle id');
    return;
  }

  if (opt.options.list ||
      (!opt.options.watch && !opt.options.remove && opt.argv.length < 1)) {
    Battle.find({
      country: country,
      channel: channel,
    }, function(error, battles) {
      const l = battles.length;
      if (l === 0) {
        bot.say(to, 'Watchlist is empty');
        return;
      }

      for (let i = 0; i < l; i++) {
        bot.say(to,
          `${i + 1}. ` +
          `${country.server.address}/battle.html?id=${battles[i].battleId} - ` +
          `${battles[i].label ? battles[i].label : battles[i].side}`);
      }
    });
  } else if (opt.argv.length < 1) {
    bot.say(to, 'Not enough arguments');
  } else if (opt.options.remove) {
    Battle.findOne({
      battleId: battleId,
      country: country,
      channel: channel,
    }, function(error, battle) {
      if (error) {
        bot.say(to, `Failed to watch battle: ${error}`);
        return;
      }

      if (!battle) {
        bot.say(to, 'Battle not found in watchlist');
        return;
      }

      if (watchlist[battle.id] !== null) {
        clearTimeout(watchlist[battle.id]);
        battle.remove(function(error, battle) {
          bot.say(to, 'Battle deleted from watchlist');
          delete watchlist[battle.id];
        });
      } else {
        bot.say(to, 'Failed to delete watch. Please try again.');
      }
    });
  } else {
    Battle.findOne({
      battleId: battleId,
      country: country,
      channel: channel,
    }, function(error, battle) {
      if (error) {
        bot.say(to, `Failed to watch battle: ${error}`);
        return;
      }

      if (battle) {
        if (watchlist[battle.id] !== null) {
          clearTimeout(watchlist[battle.id]);
          battle.remove(function(error, battle) {
            delete watchlist[battle.id];
          });
        } else {
          bot.say(to, 'Failed to delete previous watch. Please try again.');
          return;
        }
      }

      Battle.create({
        battleId: battleId,
        country: country,
        channel: channel,
        side: side,
        mode: mode,
      }, function(error, battle) {
        battle.populate('channel', function(error, battle) {
          if (!country.organizations.length) {
            bot.say(to, 'Failed to watch battle: Organization not found.');
            return;
          }

          watchBattle(bot, country.organizations[0], battle,
          function(error, result) {
            if (error) {
              bot.say(to, `Failed to watch battle: ${error}`);
            }
          });
        });
      });
    });
  }
}

function showBattleRound(
  bot, organization, battle, battleInfo, battleRoundInfo
) {
  const server = organization.country.server;

  const defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
  const attackerScore = numeral().unformat(battleRoundInfo.attackerScore);
  const totalScore = defenderScore + attackerScore;

  const side = battle.side;
  let wall = 0;
  let percentage = 0;
  let bonusRegion = null;

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

  if (battleInfo.type === 'resistance' ||
      (battleInfo.type === 'direct' && side === 'defender')) {
    bonusRegion = `${battleInfo.label}, ${battleInfo.defender}`;
  } else if (battleInfo.type === 'direct' && side === 'attacker') {
    const allies = battleInfo.attackerAllies.slice();
    allies.unshift(battleInfo.attacker);

    server.getAttackerBonusRegion(battleInfo.id, allies,
    function(error, region) {
      if (error) {
        console.log(`Error: ${error}`);
      }

      bonusRegion = (error ? null : region);
      show();
    });
    return;
  }

  show();

  function show() {
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

    const urlSection = `${server.address}/battle.html?id=${battle.battleId}`;
    const summarySection =
        `${ul}${bold}${battleInfo.label}${reset} ` +
        `(${defSide ? def : atk}) - ` +
        `${bold}R${rnd}${reset} ` +
        `(${defSide ? dg : dr}${bold}${defWins}${reset}:` +
        `${defSide ? dr : dg}${bold}${atkWins}${reset})`;
    const bonusSection =
        bonusRegion ? `${bold}Bonus: ${reset}${bonusRegion}` : null;
    const percentSection =
        `${bold}${winning ? `${dg}Winning` : `${dr}Losing`}${reset}: ` +
        `${numeral(percentage).format('0.00%')}`;
    const wallSection =
        `${bold}Wall: ${winning ? dg : dr}` +
        `${numeral(wall).format('+0,0')}${reset}`;
    const timeSection =
        `${bold}Time: ${reset}0${numeral(time).format('00:00:00')}`;

    const sections = [
      urlSection,
      summarySection,
      bonusSection,
      percentSection,
      wallSection,
      timeSection,
    ].filter((value) => value !== null);

    bot.say(battle.channel.name, sections.join(' | '));
  }
}

function watchBattleRound(
  bot, organization, battle, battleInfo, battleRoundInfo, time, callback
) {
  const timeout = function(watchpoint) {
    watchlist[battle.id] = null;
    organization.getBattleRoundInfo(battleInfo.roundId,
      function(error, battleRoundInfo) {
        if (error) {
          callback(error);
          return;
        }

        let frozen = false;

        if (battleRoundInfo.remainingTimeInSeconds === time && time > 0) {
          frozen = true;
        } else if (watchpoint === 600) {
          call.call(
            bot, battle.channel.name,
            'T-10 --- Get ready to fight!!!');
        } else if (watchpoint === 300) {
          call.call(
            bot, battle.channel.name,
            'T-5 --- Standby --- hit at T-2 if bar is below 52%!!!');
        } else if (watchpoint === 120) {
          const defenderScore = numeral()
            .unformat(battleRoundInfo.defenderScore);
          const attackerScore = numeral()
            .unformat(battleRoundInfo.attackerScore);
          const totalScore = defenderScore + attackerScore;

          let percentage = 0;

          if (battle.side === 'defender') {
            percentage = defenderScore / totalScore;
          } else if (battle.side === 'attacker') {
            percentage = attackerScore / totalScore;
          }

          if (!isFinite(percentage)) {
            percentage = 0;
          }

          call.call(
            bot, battle.channel.name, `T-2 --- ${
            percentage < 0.52 ?
              'Start hitting!!!' :
              'Hold your hits --- Only hit when bar drops below 52%!!!'}`);
        }

        if (!frozen) {
          showBattleRound(
            bot, organization, battle, battleInfo, battleRoundInfo);
        }
        watchBattleRound(
          bot, organization, battle, battleInfo, battleRoundInfo,
          battleRoundInfo.remainingTimeInSeconds, callback);
      });
  };

  const l = watchpoints[battle.mode].length;
  for (let i = 0; i < l; i++) {
    if (battleRoundInfo.remainingTimeInSeconds > watchpoints[battle.mode][i]) {
      watchlist[battle.id] = setTimeout(
          timeout,
          (battleRoundInfo.remainingTimeInSeconds -
            watchpoints[battle.mode][i]) * 1000,
          watchpoints[battle.mode][i]);

      return;
    }
  }

  const defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
  const attackerScore = numeral().unformat(battleRoundInfo.attackerScore);

  const winner = defenderScore >= attackerScore ?
      battleInfo.defender : battleInfo.attacker;

  bot.say(battle.channel.name,
    `The round has ended in favor of ${winner}`);
  callback(null);
}

function watchBattle(bot, organization, battle, callback) {
  organization.getBattleInfo(battle.battleId, function(error, battleInfo) {
    if (error) {
      callback(error);
      return;
    }

    if (!battle.label) {
      const side = battle.side === 'defender' ?
          battleInfo.defender : battleInfo.attacker;
      battle.label = `${battleInfo.label} (${side})`;
      battle.save();
    }

    organization.getBattleRoundInfo(battleInfo.roundId,
      function(error, battleRoundInfo) {
        if (error) {
          callback(error);
          return;
        }

        if (battleRoundInfo.remainingTimeInSeconds < 0) {
          const defenderScore = numeral()
            .unformat(battleRoundInfo.defenderScore);
          const attackerScore = numeral()
            .unformat(battleRoundInfo.attackerScore);

          const winner = defenderScore >= attackerScore ?
            battleInfo.defender : battleInfo.attacker;

          bot.say(battle.channel.name,
              `The battle has ended in favor of ${winner}`);
          callback(null);

          battle.remove(function(error, battle) {
            if (watchlist.hasOwnProperty(battle.id)) {
              delete watchlist[battle.id];
            }
          });

          return;
        }

        showBattleRound(
          bot, organization, battle, battleInfo, battleRoundInfo);
        watchBattleRound(
          bot, organization, battle, battleInfo, battleRoundInfo,
          battleRoundInfo.remainingTimeInSeconds,
          function(error) {
            if (error) {
              callback(error);
            }

            watchlist[battle.id] = setTimeout(function() {
              watchlist[battle.id] = null;
              watchBattle(bot, organization, battle, callback);
            }, 30000);
          });
      });
  });
}

module.exports.watchBattle = watchBattle;
