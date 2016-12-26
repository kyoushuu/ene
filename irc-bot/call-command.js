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

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = function(bot, from, to, argv, raw) {
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

    const query = Channel.findOne({name: to}).populate({
      path: 'countries',
      match: {
        'accessList.account': user._id,
      },
    });
    query.exec(function(error, channel) {
      if (error) {
        bot.say(to, `Error: ${error}`);
        return;
      } else if (!channel) {
        bot.say(to, 'Channel not registered in database.');
        return;
      } else if (!channel.countries.length && user.accessLevel < 4) {
        bot.say(to, 'Permission denied.');
        return;
      }

      const message = raw.trimLeft();
      call(bot, to, message.substring(message.indexOf(' ') + 1));
    });
  });
};

function call(bot, to, message) {
  bot.once(`names${to}`, function(nicks) {
    const names = Object.getOwnPropertyNames(nicks);
    names.splice(names.indexOf(bot.nick), 1);

    bot.say(to, `${codes.bold}Listen up! ${codes.reset}${names.join(' ')}`);

    if (message) {
      bot.say(to,
        `${codes.bold + codes.black},07` +
        `############# ${message} #############` +
        `${codes.reset}`);
    }
  });
  bot.send('NAMES', to);
}

module.exports.call = call;
