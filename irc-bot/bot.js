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
var parse = require('shell-quote').parse;

var motivate = require('./motivate-command');
var donate = require('./donate-command');
var supply = require('./supply-command');
var battle = require('./battle-command');
var watch = require('./watch-command');
var call = require('./call-command');

var nickname = require('./nickname-command');
var announce = require('./announce-command');
var join = require('./join-command');
var part = require('./part-command');

var Channel = require('../models/channel');
var Battle = require('../models/battle');


var bot = new irc.Client(process.env.IRC_SERVER, process.env.IRC_NICKNAME, {
  userName: process.env.IRC_USERNAME,
  realName: process.env.IRC_REALNAME,
  channels: [],
  floodProtection: true,
  autoConnect: false,
});

function isNickIdentified(nick, callback) {
  var identified = false;

  var wrapper = function(message) {
    if (message.rawCommand === '307' &&
        message.args[1] === nick &&
                message.args[2] === 'has identified for this nick') {
      identified = true;
    }
  };
  bot.addListener('raw', wrapper);

  bot.whois(nick, function(info) {
    bot.removeListener('raw', wrapper);
    callback(identified);
  });
}

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

        function makeJoinCallback(i) {
          return function() {
            Battle.find({
              channel: channels[i],
            }).populate('country channel').exec(function(error, battles) {
              if (error) {
                bot.say(channels[i].name,
                  'Failed to watch battles of this channel: ' + error);
                return;
              }

              function makePopulateCallback(j) {
                return function(error, country) {
                  watch.watchBattle(
                    bot, battles[j].country.organizations[0], battles[j],
                    function(error) {
                      if (error) {
                        bot.say(channels[i].name,
                          'Failed to watch battle #' + battles[j].battleId +
                          ': ' + error);
                      }
                    });
                };
              }

              var l = battles.length;
              for (var j = 0; j < l; j++) {
                var query = battles[j].country;
                query.populate('organizations', makePopulateCallback(j));
              }
            });
          };
        }

        var l = channels.length;
        for (var i = 0; i < l; i++) {
          var joinArgs = channels[i].name;
          if (channels[i].keyword) {
            joinArgs += ' ' + channels[i].keyword;
          }

          bot.join(joinArgs, makeJoinCallback(i));
        }
      });
    }
  });
  bot.say('NickServ', 'IDENTIFY ' + process.env.IRC_PASSWORD);
});

bot.addListener('message#', function(from, to, message) {
  if (process.env.FILTER_NICK &&
      process.env.FILTER_NICK.split(':').indexOf(from) < 0) {
    return;
  }

  var argv = parse(message);

  if (argv[0] === '!motivate') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        motivate(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  } else if (argv[0] === '!donate') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        donate(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  } else if (argv[0] === '!supply') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        supply(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  } else if (argv[0] === '!battle') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        battle(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  } else if (argv[0] === '!watch') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        watch(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  } else if (argv[0] === '!call') {
    isNickIdentified(from, function(identified) {
      if (identified) {
        call(bot, from, to, argv);
      } else {
        bot.say(to, 'Identify with NickServ first.');
      }
    });
  }
});

bot.addListener('pm', function(from, message) {
  var argv = parse(message);
  isNickIdentified(from, function(identified) {
    if (identified) {
      if (argv[0] === 'add-nickname') {
        nickname.add(bot, from, argv);
      } else if (argv[0] === 'announce') {
        announce(bot, from, argv);
      } else if (argv[0] === 'join') {
        join(bot, from, argv);
      } else if (argv[0] === 'part') {
        part(bot, from, argv);
      }
    } else {
      bot.say(from, 'Identify with NickServ first.');
    }
  });
});

bot.addListener('error', function(message) {
  console.log('Bot error: ', message);
});


module.exports = bot;
