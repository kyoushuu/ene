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


module.exports = async function(bot, to, args) {
  const {argv, help} = await parse(bot, 'part (channel)', [
  ], args, 1, 1, to, false);

  if (help) {
    return;
  }

  const user = await User.findOne({
    nicknames: to,
  });

  if (!user) {
    throw new Error('Nickname is not registered.');
  }

  if (user.accessLevel < 4) {
    throw new Error('Permission denied.');
  }

  const [channel] = argv;

  await bot.part(channel);
};
