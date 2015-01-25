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

var User = require('../models/user');


module.exports = function(bot, to, argv) {
  parse(bot, 'announce (message)', [
  ], argv, 1, 1, to, false, function(error, args) {
    if (error) {
      bot.say(to, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    User.findOne({
      nicknames: to,
    }, function(error, user) {
      if (error) {
        bot.say(to,
            'Failed to find user via nickname: ' + error);
        return;
      }

      if (user) {
        if (user.accessLevel < 4) {
          bot.say(to, 'Permission denied.');
        } else {
          announceParse_(error, bot, to, args, user);
        }
      } else {
        bot.say(to, 'Nickname is not registered.');
      }
    });
  });
};

function announceParse_(error, bot, to, args, user) {
  if (error || !args) {
    return;
  }

  var opt = args.opt;

  announce(bot, to, opt.argv[0]);
}

function announce(bot, to, message) {
  var chans = Object.getOwnPropertyNames(bot.chans);

  var l = chans.length;
  for (var i = 0; i < l; i++) {
    bot.say(chans[i], codes.bold + 'ANNOUNCEMENT: ' + codes.reset + message);
  }
}
