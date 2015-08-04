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


var irc = require('irc');
var codes = irc.colors.codes;
var numeral = require('numeral');

var parse = require('./parse');

var Channel = require('../models/channel');
var User = require('../models/user');
var Battle = require('../models/battle');

var call = require('./call-command');

var watchpoints = {
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
var watchlist = {};


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
      bot.say(to, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    var query = Channel.findOne({name: to}).populate({
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

      User.findOne({
        nicknames: from,
      }, function(error, user) {
        if (error) {
          bot.say(to,
              'Failed to find user via nickname: ' + error);
          return;
        }

        if (!user) {
          bot.say(to, 'Nickname is not registered.');
          return;
        }

        var countries = [];

        var l = channel.countries.length;
        for (var i = 0; i < l; i++) {
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

        var query = countries[0].populate('server');
        query.populate('organizations', function(error, country) {
          var j = -1;
          var l = country.channels.length;
          for (var i = 0; i < l; i++) {
            if (country.channels[i].channel.equals(channel.id)) {
              j = i;
            }
          }

          if (j < 0 ||
              country.channels[j].types.indexOf('military') < 0) {
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

  var opt = args.opt;

  var side = 'defender';
  if (opt.options.defender) {
    side = 'defender';
  } else if (opt.options.attacker) {
    side = 'attacker';
  }

  var mode = 'full';
  if (opt.options.light) {
    mode = 'light';
  } else if (opt.options.full) {
    mode = 'full';
  }

  var battleId = 0;
  if (!opt.options.list && opt.argv.length > 0) {
    battleId = parseInt(opt.argv[0]);
    if (isNaN(battleId) || battleId < 1) {
      bot.say(to, 'Invalid battle id');
      return;
    }
  }

  if (opt.options.list ||
      (!opt.options.watch && !opt.options.remove && opt.argv.length < 1)) {
    Battle.find({
      country: country,
      channel: channel,
    }, function(error, battles) {
      var l = battles.length;
      if (l === 0) {
        bot.say(to, 'Watchlist is empty');
        return;
      }

      for (var i = 0; i < l; i++) {
        bot.say(to,
          (i + 1) + '. ' +
          country.server.address + '/battle.html?id=' + battles[i].battleId +
          ' - ' + (battles[i].label ? battles[i].label : battles[i].side));
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
        bot.say(to, 'Failed to watch battle: ' + error);
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
        bot.say(to, 'Failed to watch battle: ' + error);
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
              bot.say(to, 'Failed to watch battle: ' + error);
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
  var server = organization.country.server;

  var defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
  var attackerScore = numeral().unformat(battleRoundInfo.attackerScore);
  var totalScore = defenderScore + attackerScore;

  var side = battle.side;
  var wall = 0;
  var percentage = 0;
  var bonusRegion = null;

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

  var time = battleRoundInfo.remainingTimeInSeconds;
  if (time < 0) {
    time = 0;
  }

  if (battleInfo.type === 'resistance' ||
      (battleInfo.type === 'direct' && side === 'defender')) {
    bonusRegion = battleInfo.label + ', ' + battleInfo.defender;
  } else if (battleInfo.type === 'direct' && side === 'attacker') {
    var allies = battleInfo.attackerAllies.slice();
    allies.unshift(battleInfo.attacker);

    server.getAttackerBonusRegion(battleInfo.id, allies,
    function(error, region) {
      if (error) {
        console.log('Error: ' + error);
      }

      bonusRegion = (error ? null : region);
      show();
    });
    return;
  }

  show();

  function show() {
    /* jshint camelcase: false */
    /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
    bot.say(battle.channel.name,
        server.address + '/battle.html?id=' + battle.battleId +
        ' | ' +
        codes.underline + codes.bold + battleInfo.label + codes.reset +
        ' (' +
        (side === 'defender' ? battleInfo.defender : battleInfo.attacker) +
        ') - ' +
        codes.bold + 'R' + battleInfo.round + codes.reset +
        ' (' +
        (side === 'defender' ? codes.dark_green : codes.dark_red) +
        codes.bold + battleInfo.defenderWins +
        codes.reset + ':' +
        (side === 'defender' ? codes.dark_red : codes.dark_green) +
        codes.bold + battleInfo.attackerWins +
        codes.reset + ') | ' +
        (bonusRegion ?
          codes.bold + 'Bonus: ' + codes.reset + bonusRegion + ' | ' : '') +
        codes.bold +
        (percentage > 0.5 ?
          codes.dark_green + 'Winning' :
          codes.dark_red + 'Losing') +
        codes.reset + ': ' + numeral(percentage).format('0.00%') + ' | ' +
        codes.bold + 'Wall: ' +
        (percentage > 0.5 ? codes.dark_green : codes.dark_red) +
        numeral(wall).format('+0,0') +
        codes.reset + ' | ' +
        codes.bold + 'Time: ' + codes.reset + '0' +
        numeral(time).format('00:00:00'));
    /* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */
    /* jshint camelcase: true */
  }
}

function watchBattleRound(
  bot, organization, battle, battleInfo, battleRoundInfo, time, callback
) {
  var timeout = function(watchpoint) {
    watchlist[battle.id] = null;
    organization.getBattleRoundInfo(battleInfo.roundId,
      function(error, battleRoundInfo) {
        if (error) {
          callback(error);
          return;
        }

        var frozen = false;

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
          var defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
          var attackerScore = numeral().unformat(battleRoundInfo.attackerScore);
          var totalScore = defenderScore + attackerScore;

          var percentage = 0;

          if (battle.side === 'defender') {
            percentage = defenderScore / totalScore;
          } else if (battle.side === 'attacker') {
            percentage = attackerScore / totalScore;
          }

          if (!isFinite(percentage)) {
            percentage = 0;
          }

          call.call(
            bot, battle.channel.name, 'T-2 --- ' +
            (percentage < 0.52 ?
              'Start hitting!!!' :
              'Hold your hits --- Only hit when bar drops below 52%!!!'));
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

  var l = watchpoints[battle.mode].length;
  for (var i = 0; i < l; i++) {
    if (battleRoundInfo.remainingTimeInSeconds > watchpoints[battle.mode][i]) {
      watchlist[battle.id] = setTimeout(
          timeout,
          (battleRoundInfo.remainingTimeInSeconds -
            watchpoints[battle.mode][i]) * 1000,
          watchpoints[battle.mode][i]);

      return;
    }
  }

  var defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
  var attackerScore = numeral().unformat(battleRoundInfo.attackerScore);

  bot.say(battle.channel.name,
    'The round has ended in favor of ' +
    (defenderScore >= attackerScore ?
        battleInfo.defender :
        battleInfo.attacker));
  callback(null);
}

function watchBattle(bot, organization, battle, callback) {
  organization.getBattleInfo(battle.battleId, function(error, battleInfo) {
    if (error) {
      callback(error);
      return;
    }

    if (!battle.label) {
      battle.label = battleInfo.label + ' (' +
        (battle.side === 'defender' ?
          battleInfo.defender :
          battleInfo.attacker) +
        ')';
      battle.save();
    }

    organization.getBattleRoundInfo(battleInfo.roundId,
      function(error, battleRoundInfo) {
        if (error) {
          callback(error);
          return;
        }

        if (battleRoundInfo.remainingTimeInSeconds < 0) {
          var defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
          var attackerScore = numeral().unformat(battleRoundInfo.attackerScore);

          bot.say(battle.channel.name,
              'The battle has ended in favor of ' +
              (defenderScore >= attackerScore ?
                  battleInfo.defender :
                  battleInfo.attacker));
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
