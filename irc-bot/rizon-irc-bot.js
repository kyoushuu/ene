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


import IRCBot from './irc-bot';


class RizonIRCBot extends IRCBot {
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


export default RizonIRCBot;
