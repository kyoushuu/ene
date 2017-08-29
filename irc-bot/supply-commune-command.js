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

const ChannelCommand = require('./channel-command');


class SupplyCommuneCommand extends ChannelCommand {
  constructor(bot) {
    super(bot, 'supply-commune', {
      params: [
        'organization',
        {name: 'quantities', parser: (v) => v.split('/').map(parseInt)},
        {name: 'reason', required: false, default: ''},
      ],
      options: [
        ['d', 'dry-run', 'Dry run - do not actually send items'],
        ['c', 'use-org-companies', 'Use companies of the organization'],
        ['i', 'use-org-inventory', 'Get supplies from organization\'s inventory'],
        ['j', 'jump=WORKER', 'Jump to WORKER, skipping previous workers'],
        ['S', 'skip=WORKER+', 'Skip WORKER, could be used multiple times'],
      ],
      requireCountryAccessLevel: 1,
      requireCountryChannelType: 'military',
    });
  }

  async run(from, to, {server, country, channel, user, params, options, argv}) {
    const {organization: shortname, quantities} = params;

    await country.populate('server').populate({
      path: 'organizations',
      match: {shortname},
    }).execPopulate();

    if (!country.organizations.length) {
      throw new Error('Organization not found.');
    }

    for (const [i, quantity] of quantities.entries()) {
      if (!isFinite(quantity) || quantity < 0) {
        throw new Error(`Quantity #${i + 1} is not a valid number`);
      }
    }

    let {reason} = params;
    const dryRun = options['dry-run'];
    const useOrgCompanies = options['use-org-companies'];
    const useOrgInventory = options['use-org-inventory'];
    const {jump, skip} = options;

    const [organization] = country.organizations;


    const [request] = await organization.createRequest();
    let $ = await request({
      uri: `${country.server.address}/myMilitaryUnit.html`,
      transform: (body) => cheerio.load(body),
    });

    const unitLink = $('div#unitStatusHead a').attr('href');

    if (!unitLink) {
      throw new Error('Organization has no military unit');
    }

    const unitId = parseInt(unitLink.split('=')[1]);

    if (!reason.length) {
      const day = numeral($('#contentDrop b').eq(1).text().trim()).value();
      reason = `Commune Supply: Day ${day}`;
    }

    const membersList = $('div#militaryUnitContainer ~ div').eq(0)
        .find('div').find('a.profileLink');
    const membersId = [];

    for (let i = 0; i < membersList.length; i++) {
      const member = membersList.eq(i).clone().children().remove().end();
      const citizenId = parseInt(member.attr('href').split('=')[1]);
      membersId.push(citizenId);
    }


    $ = await request({
      uri: useOrgCompanies ?
        `${country.server.address}/companies.html` :
        `${country.server.address}/militaryUnitCompanies.html`,
      transform: (body) => cheerio.load(body),
      qs: {
        id: useOrgCompanies ? undefined : unitId,
      },
    });

    const companiesList = $('#myCompaniesToSortTable tr[class]');
    const companiesId = [];

    for (let i = 0; i < companiesList.length; i++) {
      if (!parseInt(companiesList.eq(i).find('td').eq(-1).text())) {
        continue;
      }

      const company = companiesList.eq(i).find('a[href*="company"]');
      const companyId = parseInt(company.attr('href').split('=')[1]);
      companiesId.push(companyId);
    }


    const membersWorked = [];
    let jumpPos = -1;

    for (const companyId of companiesId) {
      $ = await request({
        uri: `${country.server.address}/companyWorkResults.html`,
        transform: (body) => cheerio.load(body),
        qs: {
          id: companyId,
        },
      });

      const workersList = $('#productivityTable tr:not([style])');

      for (let i = 0; i < workersList.length; i++) {
        const workerResults = workersList.eq(i).find('td');

        if (!workerResults.eq(-2).find('div').length) {
          continue;
        }

        const worker = workerResults.eq(0).find('a');
        const citizenId = parseInt(worker.attr('href').split('=')[1]);

        if (!membersId.includes(citizenId)) {
          continue;
        }

        const name = worker.clone().children().remove().end().text().trim();

        if (jump && jump.toUpperCase() === name.toUpperCase()) {
          jumpPos = membersWorked.length;
        }

        membersWorked.push({
          id: citizenId,
          name,
        });
      }
    }

    if (jump && jumpPos < 0) {
      throw new Error(`Citizen ${jump} not found in list.`);
    }


    const skipIds = [];

    if (skip) {
      for (const skipName of skip) {
        let citizenId = -1;
        for (const [j, member] of membersWorked.entries()) {
          if (skipName.toUpperCase() === member.name.toUpperCase()) {
            citizenId = j;
            break;
          }
        }

        if (citizenId < 0) {
          throw new Error(`Citizen ${skipName} not found in list.`);
        }

        skipIds.push(citizenId);
      }
    }


    if (useOrgInventory) {
      for (let i = jump ? jumpPos : 0; i < membersWorked.length; i++) {
        if (skip && skipIds.includes(i)) {
          continue;
        }

        const {name, id: citizen} = membersWorked[i];

        this.bot.say(to, `Sending supplies to ${name}...`);
        await organization.supplyProducts(
            user, citizen, quantities, reason, dryRun);
      }

      this.bot.say(to, 'Done.');
      return;
    }


    const recipients = [];

    for (let i = jump ? jumpPos : 0; i < membersWorked.length; i++) {
      if (skip && skipIds.includes(i)) {
        continue;
      }

      this.bot.say(
          to,
          `Sending supplies to ${membersWorked[i].name}...`);
      recipients.push(membersWorked[i].id);
    }


    if (dryRun) {
      this.bot.say(to, 'Done.');
      return;
    }


    const supplyFormat = country.supplyFormat.split('/');

    for (let i = 0; i < supplyFormat.length; i++) {
      if (quantities[i] < 1) {
        continue;
      }

      const [product] = supplyFormat[i].split(':');
      const quantity = quantities[i];

      try {
        await organization.batchDonateProducts(
            user, recipients, product,
            quantity, reason);
      } catch (error) {
        throw new Error(`Failed to send ${product}: ${error}`);
      }
    }

    this.bot.say(to, 'Done.');
  }
}


module.exports = SupplyCommuneCommand;
