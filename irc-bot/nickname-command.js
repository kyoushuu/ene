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


const parse = require('./parse');

const User = require('../models/user');


exports.add = async function(bot, from, args) {
  const {argv, help} = await parse(bot, 'add-nickname (username) (password)', [
  ], args, 2, 2, from, false);

  if (help) {
    return;
  }

  const user = await User.findOne({username: argv[0]});

  if (!user || !user.isValidPassword(argv[1])) {
    throw new Error('Invalid username or password');
  } else if (user.nicknames.includes(from)) {
    throw new Error('Nickname is already added');
  }

  user.nicknames.push(from);
  await user.save();

  bot.say(from, 'Nickname successfully added.');
};
