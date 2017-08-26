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


const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = async function(bot, from, to, args, raw) {
  const user = await User.findOne({
    nicknames: from,
  });

  if (!user) {
    throw new Error('Nickname is not registered.');
  }

  const channel = await Channel.findOne({name: to}).populate({
    path: 'countries',
    match: {
      'accessList.account': user._id,
    },
  });

  if (!channel) {
    throw new Error('Channel not registered in database.');
  } else if (!channel.countries.length && user.accessLevel < 4) {
    throw new Error('Permission denied.');
  }

  const messageTrimmed = raw.trimLeft();
  const message = messageTrimmed.substring(messageTrimmed.indexOf(' ') + 1);

  bot.callEveryone(to, message);
};
