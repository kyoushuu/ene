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
    const $ = await request({
      uri: `${country.server.address}/myMilitaryUnit.html`,
      ensureSignedIn: true,
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
    const membersId = membersList.get().map((a) =>
      parseInt(
          $(a).clone().children().remove().end().attr('href').split('=')[1]
      ));


    const companies =
      await organization.getCompanies(useOrgCompanies ? undefined : unitId);
    const companiesResults = await Promise.all(
        companies
            .filter((a) => a.workers > 0)
            .map((a) => organization.getCompanyWorkResults(a.id)));
    const citizensWorked = companiesResults.reduce((a, b) => a.concat(b), []);
    const membersWorked =
      citizensWorked.filter((a) => membersId.includes(a.id));
    const jumpPos = jump ?
      membersWorked.findIndex((a) => jump.localeCompare(a.name) === 0) :
      -1;

    if (jump && jumpPos < 0) {
      throw new Error(`Citizen ${jump} not found in list.`);
    }


    const skipIds = (skip ? skip : []).map((name) =>
      membersWorked.findIndex((m) => name.localeCompare(m.name) === 0));
    const skipNotFound = skipIds.indexOf(-1);

    if (skip && skipNotFound >= 0) {
      throw new Error(`Citizen ${skip[skipNotFound]} not found in list.`);
    }

    const recipients =
      membersWorked.filter((e, i) => i >= jumpPos && !skipIds.includes(i));


    if (useOrgInventory) {
      for (const {name, id} of recipients) {
        this.bot.say(to, `Sending supplies to ${name}...`);
        /* eslint-disable no-await-in-loop */
        await organization.supplyProducts(
            user, id, quantities, reason, dryRun);
        /* eslint-enable no-await-in-loop */
      }

      this.bot.say(to, 'Done.');
      return;
    }

    for (const {name} of recipients) {
      this.bot.say(
          to,
          `Sending supplies to ${name}...`);
    }


    if (dryRun) {
      this.bot.say(to, 'Done.');
      return;
    }


    const recipientsId = recipients.map((cit) => cit.id);
    const results = await Promise.all(country.supplyFormat.split('/')
        .map((a, i) => ({
          product: a.split(':')[0],
          quantity: quantities[i] || 0,
        }))
        .filter((a) => a.quantity < 1)
        .map((a) => {
          const p = organization.batchDonateProducts(
              user, recipientsId, a.product, a.quantity, reason);

          return p.catch((e) => {
            e.product = a.product;
            return e;
          });
        }));

    const errors = results.filter((a) => a instanceof Error);

    if (errors.length) {
      const products = errors.map((e) => e.product).join(', ');
      const messages = errors.map((e) => e.message).join(', ');
      throw new Error(`Failed to send ${products}: ${messages}`);
    }

    this.bot.say(to, 'Done.');
  }
}


module.exports = SupplyCommuneCommand;
