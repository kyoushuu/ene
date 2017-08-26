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


const mongoose = require('mongoose');
const crypto = require('crypto');
const request = require('request-promise-native');
const cheerio = require('cheerio');
const numeral = require('numeral');
const moment = require('moment-timezone');

const Server = require('./server');
const Country = require('./country');
const ProductDonation = require('./product-donation');
const BatchProductDonation = require('./batch-product-donation');


const secret = process.env.SECRET_KEY || process.env.OPENSHIFT_SECRET_TOKEN;

function cipherValue(value) {
  if (!value) {
    return null;
  }

  const cipher = crypto.createCipher('aes-256-cbc', secret);
  return cipher.update(value, 'binary', 'base64') + cipher.final('base64');
}

function decipherValue(value) {
  if (!value) {
    return null;
  }

  const decipher = crypto.createDecipher('aes-256-cbc', secret);
  return decipher.update(value, 'base64', 'binary') + decipher.final('binary');
}


class Organization extends mongoose.Model {
  async createRequest() {
    if (!this.country._id) {
      await Country.populate(this, {
        path: 'country',
      });
    }

    if (!this.country.server._id) {
      await Server.populate(this, {
        path: 'country.server',
      });
    }

    const jar = request.jar();
    if (this.cookies) {
      jar.setCookie(this.cookies, this.country.server.address);
    }

    const req = request.defaults({
      jar,
      followAllRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:30.0) ' +
            'Gecko/20100101 Firefox/30.0',
        'Accept': 'text/html,application/xhtml+xml,' +
            'application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      simple: true,
      gzip: true,
    });

    return [req, jar];
  }


  async login() {
    if (this.lock && moment().isBefore(this.lock)) {
      throw new Error(`Locked, try again after ${moment(this.lock).toNow(true)}`);
    }

    const [request, jar] = await this.createRequest();

    let $ = await request({
      uri: this.country.server.address,
      transform: (body) => cheerio.load(body),
    });

    if ($('a#userName').length) {
      return;
    }

    $ = await request({
      uri: `${this.country.server.address}/login.html`,
      transform: (body) => cheerio.load(body),
      method: 'POST',
      form: {
        login: this.username,
        password: this.password,
        remember: 'true',
        submit: 'Login',
      },
    });

    if ($('a#userName').length) {
      this.cookies = jar.getCookieString(this.country.server.address);
      await this.save();
      return;
    } else if ($('div.testDivred').length) {
      const msg = $('div.testDivred').text().trim();

      if (msg ===
          'Wrong password. Please pay attention to upper and lower case!') {
        this.lock = moment().add(1, 'days').toDate();
        await this.save();
        throw new Error('Failed to login, locked');
      }

      throw new Error(msg);
    }

    throw new Error('Failed to login');
  }


  async logout() {
    const [request] = await this.createRequest();

    const $ = await request({
      uri: `${this.country.server.address}/logout.html`,
      transform: (body) => cheerio.load(body),
    });

    if (!$('div#loginContainer').length) {
      throw new Error('Failed to logout');
    }
  }


  async donateProducts(sender, citizenId, product, quantity, reason) {
    const [request] = await this.createRequest();

    if (this.country.getUserAccessLevel(sender) < 1) {
      throw new Error('Permission denied.');
    }

    const $ = await request({
      uri: `${this.country.server.address}/donateProducts.html`,
      transform: (body) => cheerio.load(body),
      method: 'POST',
      qs: {
        id: citizenId,
      },
      form: {
        product,
        quantity,
        reason,
        submit: 'Donate',
      },
    });

    if ($('#citizenMessage div').text().trim() === 'Products sent') {
      await ProductDonation.create({
        organization: this._id,
        sender: sender._id,
        recipient: citizenId,
        product,
        quantity,
        reason,
      });
    } else if ($('#citizenMessage div').length) {
      throw new Error($('#citizenMessage div').text().trim());
    } else {
      throw new Error('Failed to donate items');
    }
  }


  async batchDonateProducts(sender, citizenIds, product, quantity, reason) {
    const [request] = await this.createRequest();

    if (this.country.getUserAccessLevel(sender) < 1) {
      throw new Error('Permission denied.');
    }

    const form = {
      product,
      quantity,
      reason,
      submit: 'Donate',
    };

    const l = citizenIds.length;
    for (let i = 0; i < l; i++) {
      form[`citizen${i + 1}`] = citizenIds[i];
    }

    const $ = await request({
      uri: `${this.country.server.address}/militaryUnitStorage.html`,
      transform: (body) => cheerio.load(body),
      method: 'POST',
      form,
    });

    if ($('#citizenMessage div').text().trim() === 'Products donated') {
      await BatchProductDonation.create({
        organization: this._id,
        sender: sender._id,
        recipients: citizenIds,
        product,
        quantity,
        reason,
      });
    } else if ($('#citizenMessage div').length) {
      throw new Error($('#citizenMessage div').text().trim());
    } else {
      throw new Error('Failed to donate items');
    }
  }


  async supplyProducts(sender, citizenId, quantities, reason, dryRun=false) {
    if (!this.country._id) {
      await Country.populate(this, {
        path: 'country',
      });
    }

    const supplyFormat = this.country.supplyFormat.split('/');

    if (quantities.length > supplyFormat.length) {
      throw new Error('Too many items');
    }

    const dayStart = this.country.getDayStart();
    const dayStartObjectId = new mongoose.Types.ObjectId(dayStart);

    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] < 1) {
        continue;
      }

      const format = supplyFormat[i].split(':');
      if (format.length < 2) {
        continue;
      }

      const [product] = format;
      const quantity = quantities[i];
      const limit = parseInt(format[1]);

      const result = await ProductDonation.aggregate([
        {
          $match: {
            _id: {$gte: dayStartObjectId},
            recipient: citizenId,
            product,
          },
        },
        {
          $group: {
            _id: null,
            total: {$sum: '$quantity'},
          },
        },
      ]);

      if (result.length && quantity + result[0].total > limit) {
        throw new Error(`Daily limit for ${product} exceeded (${limit})`);
      }
    }

    if (dryRun) {
      return;
    }

    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] < 1) {
        continue;
      }

      const [product] = supplyFormat[i].split(':');
      const quantity = quantities[i];

      try {
        await this.donateProducts(
            sender, citizenId, product, quantity, reason);
      } catch (error) {
        throw new Error(`Failed to send ${product}: ${error}`);
      }
    }
  }


  async getInventory() {
    const [request] = await this.createRequest();

    const $ = await request({
      uri: `${this.country.server.address}/militaryUnitStorage.html`,
      transform: (body) => cheerio.load(body),
    });

    const inventoryOrg = {};
    const storageOrg = $('div.storageMini');
    for (let i = 0; i < storageOrg.length; i++) {
      const images = storageOrg.eq(i).find('img');

      let product = images.eq(0).attr('src');
      product = product.substring(
          product.lastIndexOf('/') + 1,
          product.lastIndexOf('.'));

      let quality = images.eq(1).attr('src');
      if (quality) {
        quality = parseInt(quality.substring(
            quality.lastIndexOf('/') + 2,
            quality.lastIndexOf('.')));
      }

      inventoryOrg[product + (quality ? `-${quality}` : '')] =
        parseInt(storageOrg.eq(i).find('div').eq(0).text());
    }

    const inventoryMu = {};
    const storageMu = $('div.storage');
    for (let i = 0; i < storageMu.length; i++) {
      const images = storageMu.eq(i).find('img');

      let product = images.eq(0).attr('src');
      product = product.substring(
          product.lastIndexOf('/') + 1,
          product.lastIndexOf('.'));

      let quality = images.eq(1).attr('src');
      if (quality) {
        quality = parseInt(quality.substring(
            quality.lastIndexOf('/') + 2,
            quality.lastIndexOf('.')));
      }

      inventoryMu[product + (quality ? `-${quality}` : '')] =
        parseInt(storageMu.eq(i).find('div').eq(0).text());
    }

    return [inventoryOrg, inventoryMu];
  }


  async getBattleInfo(battleId) {
    const [request] = await this.createRequest();

    const $ = await request({
      uri: `${this.country.server.address}/battle.html`,
      transform: (body) => cheerio.load(body),
      qs: {
        id: battleId,
      },
    });

    if ($('div#mainFight div#fightName span').length) {
      let type = null;
      let label = null;
      let id = 0;
      let frozen = false;
      let defender = $('div#mainFight div.alliesList').eq(0).clone()
          .children().remove().end().text().trim();
      const attacker = $('div#mainFight div.alliesList').eq(1).clone()
          .children().remove().end().text().trim();

      if ($('div#newFightView div.testDivred').text().trim()
          .includes('frozen')) {
        frozen = true;
      }

      const linkSel =
        (value) => `div#mainFight div#fightName span a[href*="${value}"]`;

      if ($(linkSel('region')).text().trim() !== '') {
        label = $(linkSel('region')).text().trim();
        id = parseInt($(linkSel('region.html')).attr('href').split('=')[1]);

        if (!$('div#mainFight div#fightName span div').text().trim()
            .includes('Resistance war')) {
          type = 'direct';
        } else {
          type = 'resistance';
        }
      } else if ($(linkSel('tournament')).text().trim() !== '') {
        label = `${$(linkSel('tournament')).text().trim()} ` +
          `(${defender} vs. ${attacker})`;
        id = parseInt($(linkSel('tournament')).attr('href').split('=')[1]);
        type = 'tournament';
      } else if ($(linkSel('civilWar')).text().trim() !== '') {
        label = `Civil War (${defender})`;
        id = parseInt($(linkSel('civilWar')).attr('href').split('=')[1]);
        type = 'civil';
        defender = 'Loyalists';
      } else {
        label = 'Practice Battle';
        type = 'practice';
      }

      return {
        label,
        type,
        id,
        frozen,
        round: numeral().unformat($('div#mainFight > div').eq(2).text().trim()),
        roundId: parseInt($('input#battleRoundId').attr('value')),
        defender,
        defenderWins: $('div.fightRounds img[src$="blue_ball.png"]').length,
        defenderAllies: $('div#mainFight div.alliesPopup').eq(0).text()
            .trim().split(/\s{2,}/g),
        attacker,
        attackerWins: $('div.fightRounds img[src$="red_ball.png"]').length,
        attackerAllies: $('div#mainFight div.alliesPopup').eq(1).text()
            .trim().split(/\s{2,}/g),
      };
    } else if ($('div.testDivwhite h3').length) {
      throw new Error($('div.testDivwhite h3').text().trim());
    } else {
      throw new Error('Failed to get battle information');
    }
  }


  async getBattleRoundInfo(battleRoundId) {
    const [request] = await this.createRequest();

    const body = await request({
      uri: `${this.country.server.address}/battleScore.html`,
      qs: {
        id: battleRoundId,
        at: 0,
        ci: 0,
      },
    });

    try {
      const battleRoundInfo = JSON.parse(body);

      return battleRoundInfo;
    } catch (e) {
      const $ = cheerio.load(body);

      if ($('div.testDivwhite h3').length) {
        throw new Error($('div.testDivwhite h3').text().trim());
      } else {
        throw new Error('Failed to get battle round information');
      }
    }
  }
}


mongoose.model(Organization, {
  country: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true,
  },
  username: {
    type: String, required: true,
    validate: {
      validator: async function(value) {
        const organizations = await Organization.find({
          _id: {$ne: this._id},
          username: value,
          country: this.country,
        });

        return organizations.length === 0;
      },
      msg: 'Organization username with the same country already exists',
    },
  },
  password: {
    type: String,
    required: true,
    get: decipherValue,
    set: cipherValue,
  },
  shortname: {
    type: String, required: true, lowercase: true,
    validate: [{
      validator: /^[a-z]{2,3}$/i,
      msg: 'Short username should be two or three letters',
    }, {
      validator: async function(value) {
        const organizations = await Organization.find({
          _id: {$ne: this._id},
          shortname: value,
          country: this.country,
        });

        return organizations.length === 0;
      },
      msg: 'Organization short username with the same country already exists',
    }],
  },
  cookies: {
    type: String,
    get: decipherValue,
    set: cipherValue,
  },
  lock: {
    type: Date,
    default: null,
  },
});


module.exports = Organization;
