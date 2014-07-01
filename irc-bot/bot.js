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


var irc = require('irc');

var Channel = require('../models/channel');


var bot = new irc.Client(process.env.IRC_SERVER, process.env.IRC_NICKNAME, {
  userName: process.env.IRC_USERNAME,
  realName: process.env.IRC_REALNAME,
  channels: [],
  floodProtection: true,
});

bot.addListener('registered', function(from, to, message) {
  bot.addListener('notice', function join(from, to, message) {
    if (from === 'NickServ' &&
        message === 'Password accepted - you are now recognized.') {
      bot.removeListener('notice', join);

      Channel.find({}, function(error, channels) {
        if (error) {
          console.log(error);
          return;
        } else if (!channels || !channels.length) {
          console.log('No channels found');
          return;
        }

        var l = channels.length;
        for (var i = 0; i < l; i++) {
          var joinArgs = channels[i].name;
          if (channels[i].keyword) {
            joinArgs += ' ' + channels[i].keyword;
          }

          bot.join(joinArgs);
        }
      });
    }
  });
  bot.say('NickServ', 'IDENTIFY ' + process.env.IRC_PASSWORD);
});

bot.addListener('error', function(message) {
  console.log('Bot error: ', message);
});

process.on('SIGINT', function() {
  bot.disconnect(function() {
    console.log('IRC bot disconnected because of app termination');
  });
});
