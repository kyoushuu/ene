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


const Command = require('./command');

const User = require('../models/user');


class AddNicknameCommand extends Command {
  constructor(bot) {
    super(bot, 'add-nickname', {
      params: ['username', 'password'],
      requireRegistered: true,
    });
  }

  async run(from, {params, options, argv}) {
    const user = await User.findOne({
      username: params.username,
    });

    if (!user || !user.isValidPassword(params.password)) {
      throw new Error('Invalid username or password');
    } else if (user.nicknames.includes(from)) {
      throw new Error('Nickname is already added');
    }

    user.nicknames.push(from);
    await user.save();

    this.bot.say(from, 'Nickname successfully added.');
  }
}


exports.add = AddNicknameCommand;
