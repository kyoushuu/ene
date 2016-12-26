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


const parse = require('./parse');

const User = require('../models/user');


module.exports = function(bot, to, argv) {
  parse(bot, 'join (channel) [keyword]', [
  ], argv, 1, 2, to, false, function(error, args) {
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
          joinParse_(error, bot, to, args, user);
        }
      } else {
        bot.say(to, 'Nickname is not registered.');
      }
    });
  });
};

function joinParse_(error, bot, to, args, user) {
  if (error || !args) {
    return;
  }

  const opt = args.opt;

  join(bot, to, opt.argv[0] + (opt.argv.length > 1 ? ' ' + opt.argv[1] : ''));
}

function join(bot, to, channel) {
  bot.join(channel);
}
