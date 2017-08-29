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


const ChannelCommand = require('./channel-command');


class BattleCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'battle', {
      params: [{name: 'battleId', parser: parseInt}],
      options: [
        ['d', 'defender', 'Defender side (default)'],
        ['a', 'attacker', 'Attacker side'],
      ],
      requireCountryAccessLevel: 1,
      requireCountryChannelType: 'military',
    });
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
    await country.populate('server organizations').execPopulate();

    const [organization] = country.organizations;

    const side =
      options.defender ? 'defender' :
      options.attacker ? 'attacker' :
      'defender';

    if (!isFinite(params.battleId) || params.battleId < 1) {
      throw new Error('Invalid battle id');
    }

    await this.bot.displayBattleStatus(to, organization, {
      battleId: params.battleId, side,
    });
  }
}


module.exports = BattleCommand;
