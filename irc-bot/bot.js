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


const irc = require('irc');
const codes = irc.colors.codes;
const parse = require('shell-quote').parse;

const Channel = require('../models/channel');
const Battle = require('../models/battle');

const watchBattle = require('./watch-command').watchBattle;


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
  pm: {
    'add-nickname': require('./nickname-command').add,
    'announce': require('./announce-command'),
    'join': require('./join-command'),
    'part': require('./part-command'),
    'say': require('./say-command'),
    'act': require('./act-command'),
  },
};


class IRCBot extends irc.Client {
  constructor(server, nickname, options) {
    super(server, nickname, options);

    this.nickFilterList = [];

    this.addListener('registered', (from, to, message) => {
      this.onRegistered().catch((error) => {
        console.log(error);
      });
    });

    this.addListener('message#', (from, to, message) => {
      this.onChannelMessage(from, to, message).catch((error) => {
        this.say(to, `Error: ${error}`);
      });
    });

    this.addListener('pm', (from, message) => {
      this.onPrivateMessage(from, message).catch((error) => {
        this.say(from, `Error: ${error}`);
      });
    });

    this.addListener('error', (message) => {
      console.log('Bot error: ', message);
    });
  }


  async onRegistered() {
    await this.joinChannels();
  }

  async onChannelMessage(from, to, message) {
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
    if (this.nickFilterList.length && !this.nickFilterList.includes(from)) {
      return;
    }

    const argv = parse(message);

    if (commands.pm.hasOwnProperty(argv[0])) {
      const identified = await this.isNickIdentified(from);

      if (!identified) {
        throw new Error('Identify with NickServ first.');
      }

      commands.pm[argv[0]](this, from, argv, message);
    }
  }


  async whois(nickname) {
    const p = new Promise((resolve, reject) => {
      super.whois(nickname, (info) => {
        resolve(info);
      });
    });

    await p;
  }

  async join(channel) {
    const p = new Promise((resolve, reject) => {
      super.join(channel, resolve);
    });

    await p;
  }

  async part(channel) {
    const p = new Promise((resolve, reject) => {
      super.part(channel, resolve);
    });

    await p;
  }

  async names(channel) {
    const p = new Promise((resolve, reject) => {
      this.once(`names${channel}`, (nicks) => {
        const names = Object.getOwnPropertyNames(nicks);

        names.splice(names.indexOf(this.nick), 1);

        resolve(names);
      });
    });

    this.send('NAMES', channel);

    return await p;
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


  async isNickIdentified(nickname) {
    return await false;
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
      channel: channel,
    }).populate('country channel');

    for (const battle of battles) {
      const country = battle.country;

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
}


class RizonBot extends IRCBot {
  constructor(server, nickname, password, options) {
    super(server, nickname, options);

    this.identify = () => this.say('NickServ', `IDENTIFY ${password}`);
  }

  async isNickIdentified(nickname) {
    let identified = false;

    const wrapper = (message) => {
      if (message.rawCommand === '307' &&
          message.args[1] === nickname &&
          message.args[2] === 'has identified for this nick') {
        identified = true;
      }
    };

    this.addListener('raw', wrapper);
    await this.whois(nickname);
    this.removeListener('raw', wrapper);

    return identified;
  }

  async onRegistered() {
    const p = new Promise((resolve, reject) => {
      const listener = (from, to, message) => {
        if (from === 'NickServ' &&
            message === 'Password accepted - you are now recognized.') {
          this.removeListener('notice', listener);

          resolve();
        }
      };
      this.addListener('notice', listener);
    });

    this.identify();

    await p;
    await super.onRegistered();
  }
}


const bot = new RizonBot(
    process.env.IRC_SERVER,
    process.env.IRC_NICKNAME,
    process.env.IRC_PASSWORD,
    {
      userName: process.env.IRC_USERNAME,
      realName: process.env.IRC_REALNAME,
      channels: [],
      floodProtection: true,
      autoConnect: false,
    });

if (process.env.FILTER_NICK) {
  bot.nickFilterList = process.env.FILTER_NICK.split(':');
}


module.exports = bot;
