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

var parse = require('./parse');

var Channel = require('../models/channel');
var User = require('../models/user');


module.exports = function(bot, from, to, argv) {
  parse(bot, '!call [message]', [
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

      var query = channel.countries[0].populate('server');
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
              'Battle command not allowed for server in this ' +
              'channel.');
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

          if (user) {
            if (user.accessLevel < 4 && country.getUserAccessLevel(user) < 1) {
              bot.say(to, 'Permission denied.');
            } else {
              callParse_(error, bot, from, to, args, country, user);
            }
          } else {
            bot.say(to, 'Nickname is not registered.');
          }
        });
      });
    });
  });
};

function callParse_(error, bot, from, to, args, country, user) {
  if (error || !args) {
    return;
  }

  var opt = args.opt;

  call(bot, to, (opt.argv.length > 0 ? opt.argv[0] : null));
}

function call(bot, to, message) {
  bot.once('names' + to, function(nicks) {
    var names = Object.getOwnPropertyNames(nicks);
    names.splice(names.indexOf(bot.nick), 1);

    bot.say(to, codes.bold + 'Listen up! ' + codes.reset + names.join(' '));

    if (message) {
      bot.say(to,
        codes.bold + codes.black + ',07' +
        '############# ' + message + ' #############' +
        codes.reset);
    }
  });
  bot.send('NAMES', to);
}

module.exports.call = call;
