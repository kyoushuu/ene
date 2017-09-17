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


import getopt from 'node-getopt';

import User from '../models/user';


class Command {
  constructor(bot, name, {
    params = [],
    options = [],
    requireIdentified = true,
    requireRegistered = false,
    requireAccessLevel = 0,
  } = {}) {
    this.bot = bot;

    this.name = name;
    this.params = params;
    this.options = options;

    this.requireAccessLevel = requireAccessLevel;
    this.requireRegistered = this.requireAccessLevel ? true : requireRegistered;
    this.requireIdentified = requireIdentified || this.requireRegistered;

    this.allOptions = [].concat(options);
    this.opt = null;
  }

  /* eslint-disable require-await */
  async buildOptions() {
    if (this.opt) {
      return;
    }

    let usage = this.name;

    for (const arg of this.params) {
      const name = arg.name || arg;

      if (arg.required !== false) {
        usage += ` (${name})`;
      } else {
        const defvalue = arg.default ? `=${arg.default}`: '';

        usage += ` [${name}${defvalue}]`;
      }
    }

    this.allOptions.push(['h', 'help', 'Display this help']);

    this.opt = getopt.create(this.allOptions);
    this.opt.setHelp(`Usage: ${usage}\n\n[[OPTIONS]]\n`);
  }
  /* eslint-enable require-await */

  async parse(from, args, raw) {
    if (!this.opt) {
      await this.buildOptions();
    }

    let error = null;
    this.opt.error((e) => {
      error = e;
    });

    const {options, argv} = this.opt.parse(args.slice(1));

    if (error) {
      throw new Error(error);
    } else if (options.help) {
      return {help: true};
    }

    const requiredParams = this.params
        .filter((a) => a && a.required !== false);
    const optionalParams = this.params
        .filter((a) => a && a.required !== undefined && !a.required);

    const tryHelpMsg = `Try \u0002${this.name} --help\u0002 for more info.`;
    if (argv.length < requiredParams.length) {
      throw new Error(`Not enough arguments. ${tryHelpMsg}`);
    } else if (argv.length > requiredParams.length + optionalParams.length) {
      throw new Error(`Too many arguments. ${tryHelpMsg}`);
    }

    const params = {};

    for (const [i, arg] of requiredParams.entries()) {
      params[arg.name || arg] = arg.parser ? arg.parser(argv[i]) : argv[i];
    }

    for (const [i, arg] of optionalParams.entries()) {
      const value = argv[requiredParams.length + i];
      params[arg.name || arg] =
        arg.parser && value ? arg.parser(value) :
        value || arg.default;
    }

    if (this.requireIdentified && !await this.bot.isNickIdentified(from)) {
      throw new Error('Identify with NickServ first.');
    }

    if (this.requireRegistered) {
      const user = await User.findOne({
        nicknames: from,
      });

      if (!user) {
        throw new Error('Nickname is not registered.');
      }

      if (this.requireAccessLevel &&
          user.accessLevel < this.requireAccessLevel) {
        throw new Error('Permission denied.');
      }

      return {user, params, options, argv};
    }

    return {params, options, argv};
  }

  async run(from, {params, options, argv}) {
  }

  async getHelp() {
    if (!this.opt) {
      await this.buildOptions();
    }

    return this.opt.getHelp();
  }
}


export default Command;
