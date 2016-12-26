/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2015  Arnel A. Borja <kyoushuu@yahoo.com>
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


const cheerio = require('cheerio');
const numeral = require('numeral');

const parse = require('./parse');
const supply = require('./supply-command');

const Channel = require('../models/channel');
const User = require('../models/user');


module.exports = function(bot, from, to, argv) {
  parse(bot, '!supply-commune (organization) (supply quantity) [reason]', [
    ['d', 'dry-run', 'Dry run - do not actually send items'],
    ['c', 'use-org-companies', 'Use companies of the organization'],
    ['i', 'use-org-inventory', 'Get supplies from organization\'s inventory'],
    ['j', 'jump=WORKER', 'Jump to WORKER, skipping previous workers'],
    ['S', 'skip=WORKER+', 'Skip WORKER, could be used multiple times'],
  ], argv, 2, 3, to, true, function(error, args) {
    if (error) {
      bot.say(to, `Error: ${error}`);
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
        bot.say(to, `Error: ${error}`);
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
              `Failed to find user via nickname: ${error}`);
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

        supplyCommuneParse_(
          error, bot, from, to, args, channel, countries[0], user);
      });
    });
  });
};

function supplyCommuneParse_(
  error, bot, from, to, args, channel, country, user
) {
  if (error || !args) {
    return;
  }

  const opt = args.opt;

  const reason = opt.argv.length === 3 ? opt.argv[2] : null;

  const supplyQuantity = opt.argv[1].split('/');
  const supplyFormat = country.supplyFormat.split('/');
  if (supplyQuantity.length > supplyFormat.length) {
    bot.say(to, 'Too many items');
    return;
  }

  country.populate('server').populate({
    path: 'organizations',
    match: {shortname: opt.argv[0]},
  }, function(error, country) {
    if (!country.organizations.length) {
      bot.say(to, 'Organization not found.');
      return;
    }

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

    getMembers_(country, country.organizations[0], user, {
      supplyQuantity: supplyQuantity,
      supplyFormat: supplyFormat,
      reason: reason,
      dryRun: opt.options['dry-run'],
      useOrgCompanies: opt.options['use-org-companies'],
      useOrgInventory: opt.options['use-org-inventory'],
      jump: opt.options.jump,
      skip: opt.options.skip,
    }, bot, to);
  });
}

function getMembers_(country, organization, user, options, bot, to) {
  organization.createRequest(function(error, request, jar) {
    const url = `${country.server.address}/myMilitaryUnit.html`;
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);

        if (!$('a#userName').length) {
          organization.login(function(error) {
            if (!error) {
              getMembers_(country, organization, user, options, bot, to);
            } else {
              bot.say(to, `Failed to get military unit page: ${error}`);
            }
          });
          return;
        }

        const unitId = parseInt(
            $('div#unitStatusHead a').attr('href').split('=')[1]);
        options.unitId = unitId;

        if (options.reason === null) {
          const day = numeral().unformat($('#contentDrop b').eq(1)
            .text().trim());
          options.reason = `Commune Supply: Day ${day}`;
        }

        const membersList = $('div#militaryUnitContainer ~ div').eq(0)
          .find('div').find('a.profileLink');
        options.membersId = [];

        const l = membersList.length;
        for (let i = 0; i < l; i++) {
          const member = membersList.eq(i).clone().children().remove().end();
          const citizenId = parseInt(member.attr('href').split('=')[1]);
          options.membersId.push(citizenId);
        }

        getCompanies_(country, organization, user, options, bot, to);
        return;
      }

      const errMsg = error || `HTTP Error: ${response.statusCode}`;
      bot.say(to, `Failed to get military unit page: ${errMsg}`);
    });
  });
}

function getCompanies_(country, organization, user, options, bot, to) {
  organization.createRequest(function(error, request, jar) {
    const url = country.server.address +
      (options.useOrgCompanies ?
        '/companies.html' :
        '/militaryUnitCompanies.html');
    request(url, {
      method: 'GET',
      qs: {
        id: options.useOrgCompanies ? undefined : options.unitId,
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);

        const companiesList = $('#myCompaniesToSortTable tr[class]');
        options.companiesId = [];

        const l = companiesList.length;
        for (let i = 0; i < l; i++) {
          if (!parseInt(companiesList.eq(i).find('td').eq(-1).text())) {
            continue;
          }

          const company = companiesList.eq(i).find('a[href*="company"]');
          const companyId = parseInt(company.attr('href').split('=')[1]);
          options.companiesId.push(companyId);
        }

        options.membersWorked = [];
        options.jumpPos = -1;

        getWorkResults_(0, country, organization, user, options, bot, to);
        return;
      }
    });
  });
}

function getWorkResults_(i, country, organization, user, options, bot, to) {
  if (i >= options.companiesId.length) {
    if (options.jump && options.jumpPos < 0) {
      bot.say(to, `Citizen ${options.jump} not found in list.`);
      return;
    }

    if (options.skip) {
      options.skipIds = [];

      const l = options.skip.length;
      for (let j = 0; j < l; j++) {
        const m = options.membersWorked.length;
        let citizenId = -1;
        for (let k = 0; k < m; k++) {
          if (options.skip[j].toUpperCase() ===
              options.membersWorked[k].name.toUpperCase()) {
            citizenId = k;
            break;
          }
        }

        if (citizenId < 0) {
          bot.say(to, `Citizen ${options.skip[j]} not found in list.`);
          return;
        }

        options.skipIds.push(citizenId);
      }
    }

    if (options.useOrgInventory) {
      sendSupplies_(0, country, organization, user, options, bot, to);
      return;
    }

    options.recipients = [];
    const l = options.membersWorked.length;
    for (let j = (options.jump ? options.jumpPos : 0); j < l; j++) {
      if (options.skip && options.skipIds.includes(j)) {
        continue;
      }

      bot.say(to,
        `Sending supplies to ${options.membersWorked[j].name}...`);
      options.recipients.push(options.membersWorked[j].id);
    }

    if (options.dryRun) {
      bot.say(to, 'Done.');
      return;
    }

    sendSuppliesBatch_(0, country, organization, user, options, bot, to);
    return;
  }

  organization.createRequest(function(error, request, jar) {
    const url = `${country.server.address}/companyWorkResults.html`;
    request(url, {
      method: 'GET',
      qs: {
        id: options.companiesId[i],
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);

        const workersList = $('#productivityTable tr:not([style])');

        const l = workersList.length;
        for (let j = 0; j < l; j++) {
          const workerResults = workersList.eq(j).find('td');

          if (!workerResults.eq(-2).find('div').length) {
            continue;
          }

          const worker = workerResults.eq(0).find('a');
          const citizenId = parseInt(worker.attr('href').split('=')[1]);

          if (!options.membersId.includes(citizenId)) {
            continue;
          }

          const name = worker.clone().children().remove().end().text().trim();

          if (options.jump &&
              options.jump.toUpperCase() === name.toUpperCase()) {
            options.jumpPos = options.membersWorked.length;
          }

          options.membersWorked.push({
            id: citizenId,
            name: name,
          });
        }

        getWorkResults_(++i, country, organization, user, options, bot, to);
      }
    });
  });
}

function sendSupplies_(i, country, organization, user, options, bot, to) {
  if (i >= options.membersWorked.length) {
    bot.say(to, 'Done.');
    return;
  }

  if ((options.jump && options.jumpPos > i) ||
      (options.skip && options.skipIds.includes(i))) {
    sendSupplies_(++i, country, organization, user, options, bot, to);
    return;
  }

  const name = options.membersWorked[i].name;
  options.citizen = options.membersWorked[i].id;
  options.id = true;

  bot.say(to, `Sending supplies to ${name}...`);
  supply.supply(country, organization, user, options, function(error) {
    if (error) {
      bot.say(to, `Failed to supply ${name}: ${error}`);
      return;
    }

    sendSupplies_(++i, country, organization, user, options, bot, to);
  });
}

function sendSuppliesBatch_(i, country, organization, user, options, bot, to) {
  if (i >= options.supplyQuantity.length) {
    bot.say(to, 'Done.');
    return;
  }

  if (options.supplyQuantity[i] < 1) {
    sendSuppliesBatch_(++i, country, organization, user, options, bot, to);
    return;
  }

  const product = options.supplyFormat[i].split(':')[0];
  const quantity = parseInt(options.supplyQuantity[i]);
  organization.batchDonateProducts(
      user, options.recipients, product,
      quantity, options.reason,
      function(error) {
        if (error) {
          bot.say(to,
              `Failed to send ${quantity} items of ${product}: ${error}`);
          return;
        }

        sendSuppliesBatch_(++i, country, organization, user, options, bot, to);
      });
}
