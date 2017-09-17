/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2017  Arnel A. Borja <kyoushuu@yahoo.com>
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


import Command from './command';

import Server from '../models/server';
import Channel from '../models/channel';


class ChannelCommand extends Command {
  constructor(bot, name, opts = {}) {
    const {
      requireCountryAccessLevel = 0,
      requireCountryChannelType,
    } = opts;

    if (requireCountryAccessLevel || requireCountryChannelType) {
      opts.requireRegistered = true;
    }

    super(bot, name, opts);

    this.requireCountryAccessLevel = requireCountryAccessLevel;
    this.requireCountryChannelType = requireCountryChannelType;
  }

  async buildOptions() {
    if (this.servers) {
      return;
    }

    this.servers = await Server.find({}, null, {sort: {_id: 1}});

    for (const server of this.servers) {
      this.allOptions.push([
        server.shortname,
        server.name.toLowerCase(),
        `Set server to ${server.name}`]);
    }

    await super.buildOptions();
  }

  async parse(from, to, args, raw) {
    const {user, params, options, argv, help} =
        await super.parse(from, args, raw);

    if (help) {
      return {help};
    }

    let channel = await Channel.findOne({name: to}).populate('countries');

    for (const server of this.servers) {
      if (options[server.name.toLowerCase()]) {
        return {server, channel, user, params, options, argv};
      }
    }

    let [server] = this.servers;

    if (channel && channel.countries && channel.countries.length) {
      const [country] = channel.countries;
      await country.populate('server').execPopulate();
      ({server} = country);
    }

    if (!this.requireCountryAccessLevel && !this.requireCountryChannelType) {
      return {server, channel, user, params, options, argv};
    }

    channel = await Channel.findOne({name: to}).populate({
      path: 'countries',
      match: {server: server._id},
    });

    if (!channel) {
      throw new Error('Channel not registered in database.');
    } else if (!channel.countries.length) {
      throw new Error('Channel not registered for given server.');
    }

    const countries = [];

    for (const country of channel.countries) {
      if (this.requireCountryAccessLevel &&
          country.getUserAccessLevel(user) < this.requireCountryAccessLevel) {
        continue;
      }

      countries.push(country);
    }

    if (this.requireCountryAccessLevel && !countries.length) {
      throw new Error('Permission denied.');
    } else if (this.requireCountryAccessLevel && countries.length > 1) {
      throw new Error('Failed, you have access on multiple countries.');
    }

    const [country] = countries;

    if (country.server.disabled) {
      throw new Error('Server has been disabled.');
    }

    if (this.requireCountryChannelType) {
      let j = -1;
      for (const [i, c] of country.channels.entries()) {
        if (c.channel.equals(channel.id)) {
          j = i;
        }
      }

      if (j < 0 ||
          !country.channels[j].types.includes(this.requireCountryChannelType)) {
        throw new Error('Command not allowed for the given server in this channel.');
      }
    }

    return {server, country, channel, user, params, options, argv};
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
  }
}


export default ChannelCommand;
