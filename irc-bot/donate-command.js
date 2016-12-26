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


const parse = require('./parse');

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = function(bot, from, to, argv) {
  parse(bot, '!donate (citizen) (product) (quantity) [reason]', [
    ['i', 'id', 'Given citizen is a citizen id'],
  ], argv, 3, 4, to, true, function(error, args) {
    if (error) {
      bot.say(to, 'Error: ' + error);
      return;
    } else if (!args) {
      return;
    }

    const query = Channel.findOne({name: to}).populate({
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

        const countries = [];

        const l = channel.countries.length;
        for (let i = 0; i < l; i++) {
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

        const query = countries[0].populate('server');
        query.populate('organizations', function(error, country) {
          let j = -1;
          const l = country.channels.length;
          for (let i = 0; i < l; i++) {
            if (country.channels[i].channel.equals(channel.id)) {
              j = i;
            }
          }

          if (j < 0 ||
              !country.channels[j].types.includes('military')) {
            bot.say(to,
                'Military commands are not allowed for the given server in ' +
                'this channel.');
            return;
          }

          donateParse_(error, bot, from, to, args, country, user);
        });
      });
    });
  });
};

function donateParse_(error, bot, from, to, args, country, user) {
  if (error || !args) {
    return;
  }

  const opt = args.opt;

  const reason = opt.argv.length === 4 ? opt.argv[3] : '';

  donate(country, country.organizations[0], user, {
    citizen: opt.argv[0],
    product: opt.argv[1],
    quantity: opt.argv[2],
    reason: reason,
    id: opt.options.id,
  }, function(error) {
    if (!error) {
      bot.say(to,
          'Products successfully donated to citizen ' +
          (opt.options.id ? '#' : '') + opt.argv[0] + '.');
    } else {
      bot.say(to, 'Failed to donate products: ' + error);
    }
  });
}

function donate(country, organization, user, options, callback) {
  if (!options.id) {
    organization.createRequest(function(error, request, jar) {
      const url = country.server.address + '/apiCitizenByName.html';
      request(url, {
        method: 'GET',
        qs: {
          name: options.citizen.toLowerCase(),
        },
      }, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          const citizenInfo = JSON.parse(body);

          if (citizenInfo.error) {
            callback(citizenInfo.error);
            return;
          }

          options.citizen = citizenInfo.id;
          options.id = true;

          donate(country, organization, user, options, callback);
        } else {
          callback('Failed to get citizen info: ' +
            (error || 'HTTP Error: ' + response.statusCode));
        }
      });
    });

    return;
  }

  organization.donateProducts(
      user, options.citizen, options.product,
      options.quantity, options.reason,
      callback);
}
