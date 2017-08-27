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


const irc = require('irc');


class IRCBot extends irc.Client {
  constructor(server, nickname, options) {
    super(server, nickname, options);

    this.addListener('registered', (from, to, message) => {
      this.onRegistered().catch((error) => {
        console.log(error);
      });
    });

    this.addListener('message#', (from, to, message) => {
      this.onChannelMessage(from, to, message).catch((error) => {
        this.say(to, error);
      });
    });

    this.addListener('pm', (from, message) => {
      this.onPrivateMessage(from, message).catch((error) => {
        this.say(from, error);
      });
    });

    this.addListener('error', (error) => {
      console.log('Bot error: ', error);
    });
  }


  async onRegistered() {
  }

  async onChannelMessage(from, to, message) {
  }

  async onPrivateMessage(from, message) {
  }


  async whois(nickname) {
    return new Promise((resolve) => {
      super.whois(nickname, (info) => {
        resolve(info);
      });
    });
  }

  async join(channel, keyword = undefined) {
    return new Promise((resolve) => {
      super.join(channel + (keyword ? ` ${keyword}` : ''), resolve);
    });
  }

  async part(channel) {
    return new Promise((resolve) => {
      super.part(channel, resolve);
    });
  }

  async names(channel) {
    return new Promise((resolve) => {
      this.once(`names${channel}`, (nicks) => {
        const names = Object.getOwnPropertyNames(nicks);

        names.splice(names.indexOf(this.nick), 1);

        resolve(names);
      });

      this.send('NAMES', channel);
    });
  }
}


module.exports = IRCBot;
