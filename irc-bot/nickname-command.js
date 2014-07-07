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


var parse = require('./parse');

var User = require('../models/user');


exports.add = function(bot, from, argv) {
  parse(bot, 'add-nickname username password', [
  ], argv, 2, 2, from, false, function(error, args) {
    if (error) {
      bot.say(from, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    User.findOne({username: args.opt.argv[0]}, function(error, user) {
      if (error) {
        bot.say(from, 'Error: ' + error);
        return;
      } else if (!user || !user.isValidPassword(args.opt.argv[1])) {
        bot.say(from, 'Error: Invalid username or password');
        return;
      } else if (user.nicknames.indexOf(from) >= 0) {
        bot.say(from, 'Error: Nickname is already added');
        return;
      }

      user.nicknames.push(from);
      user.save(function(error) {
        if (error) {
          bot.say(from, 'Error: ' + error);
          return;
        }

        bot.say(from, 'Nickname successfully added.');
      });
    });
  });
};
