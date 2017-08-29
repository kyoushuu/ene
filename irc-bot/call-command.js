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


class CallCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'call', {
      params: [{name: 'message', required: false}],
      requireCountryAccessLevel: 2,
    });
  }

  async parse(from, to, args, raw) {
    const {help} = await super.parse(from, to, args, raw);

    return {help, raw};
  }

  async run(from, to, {raw}) {
    const line = raw.trimLeft();
    const message = line.substring(line.indexOf(' ') + 1);

    await this.bot.callEveryone(to, message);
  }
}


module.exports = CallCommand;
