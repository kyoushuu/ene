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


import EsimIRCBot from './esim-irc-bot';


const bot = new EsimIRCBot(
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


export default bot;
