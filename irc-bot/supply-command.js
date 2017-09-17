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


import ChannelCommand from './channel-command';


class BattleCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'supply', {
      params: [
        'citizen',
        {name: 'quantities', parser: (v) => v.split('/').map(parseInt)},
        {name: 'reason', required: false, default: ''},
      ],
      options: [
        ['i', 'id', 'Given citizen is a citizen id'],
        ['d', 'dry-run', 'Dry run - do not actually send items'],
        ['f', 'from=ORGANIZATION', 'Get supplies from ORGANIZATION'],
      ],
      requireCountryAccessLevel: 2,
      requireCountryChannelType: 'military',
    });
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
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

    const [organization] = country.organizations;

    const {citizen, quantities, reason} = params;
    const dryRun = options['dry-run'];

    for (const [i, quantity] of quantities.entries()) {
      if (!isFinite(quantity) || quantity < 0) {
        throw new Error(`Quantity #${i + 1} is not a valid number`);
      }
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

    const recipient = `${options.id ? '#' : ''}${citizen}`;
    this.bot.say(to, `Supplies successfully donated to citizen ${recipient}.`);
  }
}


export default BattleCommand;
