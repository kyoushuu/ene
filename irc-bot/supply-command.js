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

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = async function(bot, from, to, args) {
  const {server, options, argv, help} = await parse(bot, '!supply (citizen) (supply quantity) [reason]', [
    ['i', 'id', 'Given citizen is a citizen id'],
    ['d', 'dry-run', 'Dry run - do not actually send items'],
    ['f', 'from=ORGANIZATION', 'Get supplies from ORGANIZATION'],
  ], args, 2, 3, to, true);

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

  if (countries.length > 1) {
    throw new Error('Failed, you have access on multiple countries.');
  } else if (!countries.length || countries[0].getUserAccessLevel(user) < 2) {
    throw new Error('Permission denied.');
  }

  const [country] = countries;

  const reason = argv.length === 3 ? argv[2] : '';

  let query = country;

  if (options.from) {
    if (country.getUserAccessLevel(user) < 3) {
      throw new Error('Permission denied.');
    }

    query = query.populate({
      path: 'organizations',
      match: {shortname: options.from},
    });
  } else {
    query = query.populate('organizations');
  }

  await query.populate('server').execPopulate();


  if (country.organizations.length < 1) {
    throw new Error('Organization not found.');
  }

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

  const [citizen] = argv;
  const dryRun = options['dry-run'];

  const quantities = [];
  const quantitiesStr = argv[1].split('/');
  for (let i = 0; i < quantitiesStr.length; i++) {
    const quantity = quantitiesStr[i];

    if (!isFinite(quantity) || quantity < 0) {
      throw new Error(`Quantity #${i + 1} is not a valid number`);
    }

    quantities.push(parseInt(quantity));
  }

  let citizenId = 0;

  if (!options.id) {
    const citizenInfo = await country.server.getCitizenInfoByName(citizen);
    citizenId = citizenInfo.id;
  } else {
    citizenId = parseInt(citizen);
  }

  await organization.supplyProducts(
      user, citizenId, quantities, reason, dryRun);

  const recipient = `${options.id ? '#' : ''}${argv[0]}`;
  bot.say(to, `Supplies successfully donated to citizen ${recipient}.`);
};
