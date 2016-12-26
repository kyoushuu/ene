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


const parseArgv = function(
        bot, servers, usage, commandOptions, argv, min, max,
        to, callback) {
  const command = usage.split(' ')[0];
  const commonOptions = [
    ['h', 'help', 'Display this help'],
  ];
  const serverOptions = [];
  let allOptions = commandOptions;

  const l = servers.length;
  for (let i = 0; i < l; i++) {
    serverOptions.push([
      servers[i].shortname,
      servers[i].name.toLowerCase(),
      `Set server to ${servers[i].name}`]);
  }
  if (serverOptions.length) {
    allOptions = allOptions.concat(serverOptions);
  }

  allOptions = allOptions.concat(commonOptions);

  const options = getopt.create(allOptions);
  options.setHelp(`Usage: ${usage}\n\n[[OPTIONS]]\n`);

  let error = null;
  options.error((e) => {
    error = e;
  });

  const opt = options.parse(argv.slice(1));

  if (error) {
    bot.say(to, error);
    return callback(null, null);
  } else if (opt.options.help) {
    bot.say(to, options.getHelp());
    return callback(null, null);
  } else if (opt.argv.length < min) {
    bot.say(to, 'Not enough arguments.');
    bot.say(to, `Try \u0002${command} --help\u0002 for more info.`);
    return callback(null, null);
  } else if (opt.argv.length > max) {
    bot.say(to, 'Too many arguments.');
    bot.say(to, `Try \u0002${command} --help\u0002 for more info.`);
    return callback(null, null);
  }

  const query = Channel.findOne({name: to}).populate('countries');
  query.exec((error, channel) => {
    if (error) {
      callback(error);
      return;
    }

    const l = servers.length;
    for (let i = 0; i < l; i++) {
      if (opt.options[servers[i].name.toLowerCase()]) {
        callback(null, {server: servers[i], opt: opt});
        return;
      }
    }

    if (channel && channel.countries && channel.countries.length) {
      channel.countries[0].populate('server', (error, country) => {
        callback(error, {server: country.server, opt: opt});
      });
    } else {
      callback(null, {server: servers[0], opt: opt});
    }
  });
};

module.exports = function(
        bot, usage, commandOptions, argv, min, max,
        to, addServerOptions, callback) {
  if (addServerOptions) {
    Server.find({}, null, {sort: {_id: 1}}, (error, servers) => {
      parseArgv(
          bot, servers, usage, commandOptions, argv, min, max,
          to, callback);
    });
  } else {
    parseArgv(
        bot, [], usage, commandOptions, argv, min, max,
        to, callback);
  }
};
