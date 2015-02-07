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


module.exports = function(bot, from, to, argv) {
  parse(bot, '!battle (id)', [
    ['d', 'defender', 'Defender side (default)'],
    ['a', 'attacker', 'Attacker side'],
  ], argv, 1, 1, to, true, function(error, args) {
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

  var opt = args.opt;

  var side = 'defender';
  if (opt.options.defender) {
    side = 'defender';
  } else if (opt.options.attacker) {
    side = 'attacker';
  }

  var battleId = parseInt(opt.argv[0]);
  if (isNaN(battleId) || battleId < 1) {
    bot.say(to, 'Invalid battle id');
    return;
  }

  battleShow(country, country.organizations[0], {
    battleId: battleId,
    side: side,
  }, function(error, result) {
    if (!error) {
      bot.say(to, result);
    } else {
      bot.say(to, 'Failed to show battle: ' + error);
    }
  });
}

function battleShow(country, organization, options, callback) {
  organization.getBattleInfo(options.battleId, function(error, battleInfo) {
    if (error) {
      callback(error);
      return;
    }

    organization.getBattleRoundInfo(battleInfo.roundId,
      function(error, battleRoundInfo) {
        if (error) {
          callback(error);
          return;
        }

        var defenderScore = numeral().unformat(battleRoundInfo.defenderScore);
        var attackerScore = numeral().unformat(battleRoundInfo.attackerScore);
        var totalScore = defenderScore + attackerScore;

        var side = options.side;
        var wall = 0;
        var percentage = 0;

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

        /* jshint camelcase: false */
        /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
        callback(null,
            country.server.address + '/battle.html?id=' + options.battleId +
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
      });
  });
}
