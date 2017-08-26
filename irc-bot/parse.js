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


const getopt = require('node-getopt');

const Server = require('../models/server');
const Channel = require('../models/channel');


module.exports = async function(
    bot, usage, commandOptions, args, min, max,
    to, addServerOptions) {
  const servers = addServerOptions?
    await Server.find({}, null, {sort: {_id: 1}}) : [];

  const [command] = usage.split(' ');
  const commonOptions = [
    ['h', 'help', 'Display this help'],
  ];
  const serverOptions = [];
  let allOptions = commandOptions;

  for (const server of servers) {
    serverOptions.push([
      server.shortname,
      server.name.toLowerCase(),
      `Set server to ${server.name}`]);
  }

  if (serverOptions.length) {
    allOptions = allOptions.concat(serverOptions);
  }

  allOptions = allOptions.concat(commonOptions);

  const opt = getopt.create(allOptions);
  opt.setHelp(`Usage: ${usage}\n\n[[OPTIONS]]\n`);

  let error = null;
  opt.error((e) => {
    error = e;
  });

  const {options, argv} = opt.parse(args.slice(1));

  if (error) {
    throw new Error(error);
  } else if (options.help) {
    bot.say(to, opt.getHelp());
    return {help: true};
  }

  const tryHelpMsg = `Try \u0002${command} --help\u0002 for more info.`;
  if (argv.length < min) {
    throw new Error(`Not enough arguments. ${tryHelpMsg}`);
  } else if (argv.length > max) {
    throw new Error(`Too many arguments. ${tryHelpMsg}`);
  }

  for (const server of servers) {
    if (options[server.name.toLowerCase()]) {
      return {server, options, argv};
    }
  }

  const channel = await Channel.findOne({name: to}).populate('countries');

  if (channel && channel.countries && channel.countries.length) {
    const [country] = channel.countries;
    await country.populate('server').execPopulate();
    return {server: country.server, options, argv};
  } else {
    return {server: servers[0], options, argv};
  }
};
