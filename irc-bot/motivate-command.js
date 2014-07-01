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


var cheerio = require('cheerio');

var parse = require('./parse');

var Channel = require('../models/channel');

var motivateLock = {};
var motivateDate = {};


module.exports = function(bot, from, to, argv) {
  parse(bot, '!motivate [find=5]', [
    ['w', 'weapon', 'Use q1 weapons'],
    ['f', 'food', 'Use q3 foods (default)'],
    ['g', 'gift', 'Use q3 gifts'],
    ['m', 'message', 'Send links as private message'],
    ['n', 'notify', 'Send links as notice (default)'],
  ], argv, 0, 1, to, true, function(error, args) {
    if (error) {
      bot.say(to, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    var query = Channel.findOne({name: to}).populate({
      path: 'countries',
      match: {server: args.server._id},
    });
    query.exec(function(error, channel) {
      if (error) {
        bot.say(to, 'Error: ' + error);
        return;
      } else if (!channel) {
        bot.say(to, 'Channel not registered in database.');
        return;
      } else if (!channel.countries.length) {
        bot.say(to, 'Channel not registered for given server.');
        return;
      }

      var query = channel.countries[0].populate('server');
      query.populate('organizations', function(error, country) {
        var j = -1;
        var l = country.channels.length;
        for (var i = 0; i < l; i++) {
          if (country.channels[i].channel.equals(channel.id)) {
            j = i;
          }
        }

        if (j < 0 ||
            country.channels[j].types.indexOf('motivation') < 0) {
          bot.say(to,
              'Motivate command not allowed for server in this ' +
              'channel.');
          return;
        }

        motivateParse_(error, bot, from, to, args, country);
      });
    });
  });
};

function motivateParse_(error, bot, from, to, args, country) {
  if (error || !args) {
    return;
  }

  var server = args.server;
  var opt = args.opt;

  if (motivateLock[server.name] &&
      Date.now() - motivateLock[server.name].date < 120000 &&
      motivateLock[server.name].nick !== from) {
    if (motivateLock[server.name].done) {
      var elapsedTime = Date.now() - motivateLock[server.name].date;
      var remainingTime = (2 * 60) - (elapsedTime / 1000);
      bot.say(to,
          'Command is locked in given server. Someone else used ' +
          'the command less than two minutes ago. Please try again ' +
          'after ' + remainingTime.toFixed(2) + ' seconds.');
      return;
    } else {
      bot.say(to,
          'Command is currently in use and therefore locked in ' +
          'given server. Please wait 2 minutes after the current ' +
          'user is done.');
      return;
    }
  }

  motivateLock[server.name] = {
    date: Date.now(),
    nick: from,
    done: false,
  };

  if (!motivateDate[from]) {
    motivateDate[from] = {};
  }

  if (Date.now() - motivateDate[from][server.name] < 12 * 60 * 60 * 1000 &&
      opt.argv.length < 1) {
    bot.say(to,
        'WARNING: You last used this command less than 12 hours ago. ' +
                'You are allowed to use this command once per server per day ' +
                'only. Abusers will be banned in this channel. Please ignore ' +
                'this warning if you last used this command before the last ' +
                'day change.');
  }
  motivateDate[from][server.name] = Date.now();

  var notify = true;
  if (opt.options.message) {
    notify = false;
  }

  var pack = 'food';
  if (opt.options.weapon) {
    pack = 'weapon';
  } else if (opt.options.food) {
    pack = 'food';
  } else if (opt.options.gift) {
    pack = 'gift';
  }

  var find = 5;
  if (opt.argv.length === 1) {
    find = parseInt(opt.argv[0]);

    if (!isFinite(opt.argv[0]) || find < 1) {
      bot.say(to, 'Invalid find argument.');
      return;
    }
  }

  if (country.organizations.length === 0) {
    bot.say(to, 'No organizations registered for country.');
    return;
  }

  bot.say(to,
      'Looking for new citizens that can be motivated in ' + server.name +
      ' server...');

  if (notify) {
    bot.say(to,
        'Links will show up in notices/network tab, use -m option to ' +
                'show links as private message');
  } else {
    bot.say(to,
        'Links will show up as private message, use -n option to ' +
                'show links as notice');
  }

  bot.say(to, 'Need help? Run \u0002!motivate --help\u0002 or ask kyoushuu');

  motivate(country, country.organizations[0], {
    pack: pack,
    find: find,
  }, function(error, found) {
    if (!error) {
      bot.say(to, 'Done. Found ' + found + ' citizen/s.');
      if (found < find) {
        bot.say(to,
            'Not enough citizens found. You may re-run the ' +
            'command with another product but set ' +
                        '\u0002find\u0002 argument to the number of citizens ' +
                        'you need. Example: \u0002!motivate 2\u0002 to look ' +
                        'for two citizens.');
      }
    } else {
      bot.say(to, 'Failed to find citizens to motivate: ' + error);
    }
    motivateLock[server.name].date = Date.now();
    motivateLock[server.name].done = true;
  }, function(page) {
    bot.say(to, 'Checking page ' + page + '...');
    motivateLock[server.name].date = Date.now();
  }, function(motivateUrl) {
    if (notify) {
      bot.notice(from, 'Found ' + motivateUrl);
    } else {
      bot.say(from, 'Found ' + motivateUrl);
    }
    bot.say(to, 'Found a citizen to motivate');
    motivateLock[server.name].date = Date.now();
  });
}

function motivate(
        country, organization, options,
        callback, pageCallback, foundCallback) {
  organization.createRequest(function(error, request, jar) {
    var url = country.server.address + '/newCitizens.html?countryId=0';
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var $ = cheerio.load(body);

        if (!$('a#userName').length) {
          organization.login(function(error) {
            if (!error) {
              motivate(country, organization, options,
                  callback, pageCallback, foundCallback);
            } else {
              callback('Failed to get motivate page: ' + error);
            }
          });
          return;
        }

        var page = $('ul#pagination-digg li:nth-last-child(2) a');
        if (page.length) {
          page = parseInt(page.text());
          motivateCheckPage_(
              country, organization, options, request, 0, page,
              callback, pageCallback, foundCallback);
        } else {
          callback('Failed to parse motivate page.');
        }
      } else {
        callback('Failed to get motivate page: ' +
            (error || 'HTTP Error: ' + response.statusCode));
      }
    });
  });
}

function motivateCheckPage_(
        country, organization, options, request, found, page,
        callback, pageCallback, foundCallback) {
  pageCallback(page);

  var url = country.server.address +
            '/newCitizens.html?countryId=0&page=' + page;
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var $ = cheerio.load(body);

      if (!$('a#userName').length) {
        organization.login(function(error) {
          if (!error) {
            motivateCheckPage_(
                country, organization, options, request,
                found, page,
                callback, pageCallback, foundCallback);
          } else {
            callback('Failed to check page: ' + error);
          }
        });
        return;
      }

      var citizens = [];
      $('table.dataTable tr td:first-child a').each(function(i, elem) {
        citizens.push(parseInt($(this).attr('href').split('=')[1]));
      });
      motivateCheckCitizen_(
          country, organization, options, request,
          found, page, citizens, 0,
          callback, pageCallback, foundCallback);
    } else {
      callback('Failed to check page: ' +
          (error || 'HTTP Error: ' + response.statusCode));
    }
  });
}

function motivateCheckCitizen_(
        country, organization, options, request, found, page, citizens, i,
        callback, pageCallback, foundCallback) {
  var url = country.server.address +
            '/motivateCitizen.html?id=' + citizens[i];
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var $ = cheerio.load(body);

      if (!$('a#userName').length) {
        organization.login(function(error) {
          if (!error) {
            motivateCheckCitizen_(
                country, organization, options, request,
                found, page, citizens, i,
                callback, pageCallback, foundCallback);
          } else {
            callback('Failed to check citizen: ' + error);
          }
        });
        return;
      }

      var pack = 2;
      if (options.pack === 'weapon') {
        pack = 1;
      } else if (options.pack === 'food') {
        pack = 2;
      } else if (options.pack === 'gift') {
        pack = 3;
      }

      if ($('input[value=' + pack + ']').length) {
        var motivateUrl = country.server.address +
            '/motivateCitizen.html?id=' + citizens[i];
        foundCallback(motivateUrl);
        found++;
      }

      motivateCheckNextCitizen_(
          country, organization, options, request,
          found, page, citizens, i,
          callback, pageCallback, foundCallback);
    } else {
      callback('Failed to check citizen: ' +
          (error || 'HTTP Error: ' + response.statusCode));
    }
  });
}

function motivateCheckNextCitizen_(
        country, organization, options, request,
        found, page, citizens, i,
        callback, pageCallback, foundCallback) {
  if (found < options.find) {
    if (++i < citizens.length) {
      motivateCheckCitizen_(
          country, organization, options, request,
          found, page, citizens, i,
          callback, pageCallback, foundCallback);
    } else if (page > 1) {
      --page;
      motivateCheckPage_(
          country, organization, options, request, found, page,
          callback, pageCallback, foundCallback);
    } else {
      callback(null, found);
    }
  } else {
    callback(null, found);
  }
}
