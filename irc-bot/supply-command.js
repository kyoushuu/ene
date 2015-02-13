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


var mongoose = require('mongoose');
var moment = require('moment-timezone');

var parse = require('./parse');

var Channel = require('../models/channel');
var User = require('../models/user');
var ProductDonation = require('../models/productDonation');


module.exports = function(bot, from, to, argv) {
  parse(bot, '!supply (citizen) (supply quantity) [reason]', [
    ['i', 'id', 'Given citizen is a citizen id'],
    ['d', 'dry-run', 'Dry run - do not actually send items'],
    ['f', 'from=ORGANIZATION', 'Get supplies from ORGANIZATION'],
  ], argv, 2, 3, to, true, function(error, args) {
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

      User.findOne({
        nicknames: from,
      }, function(error, user) {
        if (error) {
          bot.say(to,
              'Failed to find user via nickname: ' + error);
          return;
        }

        if (!user) {
          bot.say(to, 'Nickname is not registered.');
          return;
        }

        var countries = [];

        var l = channel.countries.length;
        for (var i = 0; i < l; i++) {
          if (channel.countries[i].getUserAccessLevel(user) > 0) {
            countries.push(channel.countries[i]);
          }
        }

        if (!countries.length) {
          bot.say(to, 'Permission denied.');
          return;
        } else if (countries.length > 1) {
          bot.say(to, 'Failed, you have access on multiple countries.');
          return;
        }

        supplyParse_(error, bot, from, to, args, channel, countries[0], user);
      });
    });
  });
};

function supplyParse_(error, bot, from, to, args, channel, country, user) {
  if (error || !args) {
    return;
  }

  var opt = args.opt;

  var reason = '';
  if (opt.argv.length === 3) {
    reason = opt.argv[2];
  }

  var supplyQuantity = opt.argv[1].split('/');
  var supplyFormat = country.supplyFormat.split('/');
  if (supplyQuantity.length > supplyFormat.length) {
    bot.say(to, 'Too many items');
    return;
  }

  var query = null;
  if (opt.options.from) {
    if (country.getUserAccessLevel(user) < 3) {
      bot.say(to, 'Permission denied.');
      return;
    }

    query = country.populate({
      path: 'organizations',
      match: {shortname: opt.options.from},
    });
  } else {
    query = country.populate('organizations');
  }

  query.populate('server', function(error, country) {
    if (country.organizations.length < 1) {
      bot.say(to, 'Organization not found.');
      return;
    }

    var j = -1;
    var l = country.channels.length;
    for (var i = 0; i < l; i++) {
      if (country.channels[i].channel.equals(channel.id)) {
        j = i;
      }
    }

    if (j < 0 ||
        country.channels[j].types.indexOf('military') < 0) {
      bot.say(to,
          'Military commands are not allowed for the given server in ' +
          'this channel.');
      return;
    }

    supply(country, country.organizations[0], user, {
      citizen: opt.argv[0],
      supplyQuantity: supplyQuantity,
      supplyFormat: supplyFormat,
      reason: reason,
      id: opt.options.id,
      dryRun: opt.options['dry-run'],
    }, function(error) {
      if (!error) {
        bot.say(to,
            'Supplies successfully donated to citizen ' +
            (opt.options.id ? '#' : '') + opt.argv[0] + '.');
      } else {
        bot.say(to, 'Failed to supply: ' + error);
      }
    });
  });
}

function supply(country, organization, user, options, callback) {
  if (!options.id) {
    organization.createRequest(function(error, request, jar) {
      var url = country.server.address + '/apiCitizenByName.html';
      request(url, {
        method: 'GET',
        qs: {
          name: options.citizen.toLowerCase(),
        },
      }, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          var citizenInfo = JSON.parse(body);

          if (citizenInfo.error) {
            callback(citizenInfo.error);
            return;
          }

          options.citizen = citizenInfo.id;
          options.id = true;

          supply(country, organization, user, options, callback);
        } else {
          callback('Failed to get citizen info: ' +
            (error || 'HTTP Error: ' + response.statusCode));
        }
      });
    });

    return;
  }

  var l = options.supplyQuantity.length;
  for (var i = 0; i < l; i++) {
    var c = options.supplyQuantity[i];

    if (!isFinite(c) || c < 0) {
      callback('Quantity #' + (i + 1) + ' is not a valid number');
      return;
    }
  }

  var dayStart = moment().tz('Europe/Warsaw').startOf('day').unix();
  var dayStartObjectId = new mongoose.Types.ObjectId(dayStart);
  supplyCheckMax(organization, user, dayStartObjectId, options, 0, callback);
}

function supplyCheckMax(
        organization, user, dayStartObjectId, options, i, callback) {
  if (i >= options.supplyQuantity.length) {
    supplyDonate(organization, user, options, 0, callback);
    return;
  }

  var limit = options.supplyFormat[i].split(':');
  if (limit.length < 2) {
    supplyCheckMax(
        organization, user, dayStartObjectId, options, ++i, callback);
    return;
  }

  ProductDonation.aggregate([
    {
      $match: {
        _id: {$gte: dayStartObjectId},
        recipient: options.citizen,
        product: limit[0],
      },
    },
    {
      $group: {
        _id: null,
        total: {$sum: '$quantity'},
      },
    },
  ], function(error, result) {
    if (error) {
      callback(error);
      return;
    }

    if (result.length &&
        parseInt(options.supplyQuantity[i]) + result[0].total >
                parseInt(limit[1])) {
      callback('Daily limit for ' + limit[0] + ' exceeded (' +
          parseInt(limit[1]) + ')');
      return;
    }

    supplyCheckMax(
        organization, user, dayStartObjectId, options, ++i, callback);
  });
}

function supplyDonate(organization, user, options, i, callback) {
  if (i >= options.supplyQuantity.length || options.dryRun) {
    callback(null);
    return;
  }

  if (options.supplyQuantity[i] < 1) {
    supplyDonate(organization, user, options, ++i, callback);
    return;
  }

  var product = options.supplyFormat[i].split(':')[0];
  var quantity = parseInt(options.supplyQuantity[i]);
  organization.donateProducts(
      user, options.citizen, product,
      quantity, options.reason,
      function(error) {
        if (error) {
          callback(
              'Failed to send ' + quantity + ' items of ' +
              product + ': ' + error);
          return;
        }

        supplyDonate(organization, user, options, ++i, callback);
      });
}

module.exports.supply = supply;
