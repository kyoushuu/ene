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

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = async function(bot, from, to, args) {
  const {server, options, argv, help} = await parse(bot, '!battle (id)', [
    ['d', 'defender', 'Defender side (default)'],
    ['a', 'attacker', 'Attacker side'],
  ], args, 1, 1, to, true);

  if (help) {
    return;
  }

  const channel = await Channel.findOne({name: to}).populate({
    path: 'countries',
    match: {server: server._id},
  });

  if (!channel) {
    throw new Error('Channel not registered in database.');
  } else if (!channel.countries.length) {
    throw new Error('Channel not registered for given server.');
  }

  const user = await User.findOne({
    nicknames: from,
  });

  if (!user) {
    throw new Error('Nickname is not registered.');
  }

  const countries = [];

  for (const country of channel.countries) {
    if (country.getUserAccessLevel(user) > 0) {
      countries.push(country);
    }
  }

  if (!countries.length) {
    throw new Error('Permission denied.');
  } else if (countries.length > 1) {
    throw new Error('Failed, you have access on multiple countries.');
  }

  const [country] = countries;

  await country.populate('server organizations').execPopulate();

  let j = -1;
  const l = country.channels.length;
  for (let i = 0; i < l; i++) {
    if (country.channels[i].channel.equals(channel.id)) {
      j = i;
    }
  }

  if (j < 0 || !country.channels[j].types.includes('military')) {
    throw new Error('Military commands are not allowed for the given server in this channel.');
  }

  const [organization] = country.organizations;

  const side =
    options.defender ? 'defender' :
    options.attacker ? 'attacker' :
    'defender';

  const battleId = parseInt(argv[0]);
  if (isNaN(battleId) || battleId < 1) {
    throw new Error('Invalid battle id');
  }

  await bot.displayBattleStatus(to, organization, {battleId, side});
};
