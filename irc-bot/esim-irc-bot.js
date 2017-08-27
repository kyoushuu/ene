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


const {colors: {codes}} = require('irc');
const {parse} = require('shell-quote');

const Channel = require('../models/channel');
const Battle = require('../models/battle');

const RizonIRCBot = require('./rizon-irc-bot');
const {watchBattle} = require('./watch-command');


const commands = {
  channel: {
    '!motivate': require('./motivate-command'),
    '!donate': require('./donate-command'),
    '!supply': require('./supply-command'),
    '!supply-commune': require('./supply-commune-command'),
    '!battle': require('./battle-command'),
    '!watch': require('./watch-command'),
    '!call': require('./call-command'),
  },
  priv: {
    'add-nickname': require('./nickname-command').add,
    'announce': require('./announce-command'),
    'join': require('./join-command'),
    'part': require('./part-command'),
    'say': require('./say-command'),
    'act': require('./act-command'),
  },
};


class EsimIRCBot extends RizonIRCBot {
  constructor(server, nickname, password, options) {
    super(server, nickname, password, options);

    this.nickFilterList = [];
  }


  async onRegistered() {
    await super.onRegistered();

    await this.joinChannels();
  }

  async onChannelMessage(from, to, message) {
    await super.onChannelMessage(from, to, message);

    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (commands.channel.hasOwnProperty(argv[0])) {
      const identified = await this.isNickIdentified(from);

      if (!identified) {
        throw new Error('Identify with NickServ first.');
      }

      await commands.channel[argv[0]](this, from, to, argv, message);
    }
  }

  async onPrivateMessage(from, message) {
    await super.onPrivateMessage(from, message);

    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (commands.priv.hasOwnProperty(argv[0])) {
      const identified = await this.isNickIdentified(from);

      if (!identified) {
        throw new Error('Identify with NickServ first.');
      }

      commands.priv[argv[0]](this, from, argv, message);
    }
  }


  async joinChannels() {
    const channels = await Channel.find({});
    if (!channels || !channels.length) {
      return;
    }

    for (const channel of channels) {
      let joinArgs = channel.name;
      if (channel.keyword) {
        joinArgs += ` ${channel.keyword}`;
      }

      await this.join(joinArgs);

      try {
        await this.watchChannelBattles(channel);
      } catch (error) {
        this.say(channel.name, `Failed to watch battles: ${error}`);
      }
    }
  }

  async watchChannelBattles(channel) {
    const battles = await Battle.find({
      channel,
    }).populate('country channel');

    for (const battle of battles) {
      const {country} = battle;

      await country.populate('organizations').execPopulate();

      if (!country.organizations.length) {
        throw new Error('Organization not found.');
      }

      try {
        await watchBattle(this, country.organizations[0], battle);
      } catch (error) {
        throw new Error(`Failed to watch battle #${battle.battleId}: ${error}`);
      }
    }
  }


  async callEveryone(channel, message) {
    const names = await this.names(channel);

    this.say(
        channel,
        `${codes.bold}Listen up! ${codes.reset}${names.join(' ')}`);

    if (message) {
      this.say(
          channel,
          `${codes.bold + codes.black},07` +
          `############# ${message} #############` +
          `${codes.reset}`);
    }
  }
}


module.exports = EsimIRCBot;
