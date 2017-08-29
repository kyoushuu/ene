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


const ChannelCommand = require('./channel-command');


class DonateCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'donate', {
      params: [
        'citizen', 'product',
        {name: 'quantity', parser: parseInt},
        {name: 'reason', required: false, default: ''},
      ],
      options: [
        ['i', 'id', 'Given citizen is a citizen id'],
      ],
      requireCountryAccessLevel: 3,
      requireCountryChannelType: 'military',
    });
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
    await country.populate('server organizations').execPopulate();

    const {citizen, product, quantity, reason} = params;
    const [organization] = country.organizations;

    if (!isFinite(quantity) || quantity < 1) {
      throw new Error('Quantity is not valid');
    }

    let citizenId = 0;

    if (!options.id) {
      const citizenInfo = await country.server.getCitizenInfoByName(citizen);
      citizenId = citizenInfo.id;
    } else {
      citizenId = parseInt(citizen);
    }

    await organization.donateProducts(
        user, citizenId, product, quantity, reason);

    const recipient = `${options.id ? '#' : ''}${citizen}`;
    this.bot.say(to, `Products successfully donated to citizen ${recipient}.`);
  }
}


module.exports = DonateCommand;
