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
const request = require('request-promise-native');
const cheerio = require('cheerio');
const {URLSearchParams} = require('url');


class Server extends mongoose.Model {
  get address() {
    const suffix = this.port !== 80 ? `:${this.port}` : '';
    return `http://${this.name.toLowerCase()}.e-sim.org${suffix}`;
  }


  async getCitizenInfoByName(citizenName) {
    const citizenInfo = await request({
      uri: `${this.address}/apiCitizenByName.html`,
      qs: {
        name: citizenName.toLowerCase(),
      },
      simple: true,
      json: true,
    });

    if (citizenInfo.error) {
      throw new Error(citizenInfo.error);
    }

    return citizenInfo;
  }


  async getCountryInfoByName(countryName) {
    if (!this.countriesList) {
      this.countriesList = await request({
        uri: `${this.address}/apiCountries.html`,
        simple: true,
        json: true,
      });
    }

    for (const country of this.countriesList) {
      if (country.name.toLowerCase() ===
          countryName.toLowerCase()) {
        return country;
      }
    }

    throw new Error('Country not found');
  }


  async getRegionInfo(regionId) {
    if (!this.regionsList) {
      this.regionsList = await request({
        uri: `${this.address}/apiRegions.html`,
        simple: true,
        json: true,
      });
    }

    for (const region of this.regionsList) {
      if (region.id === regionId) {
        return region;
      }
    }

    throw new Error('Region not found');
  }


  async getRegionStatus(regionId) {
    const regionsStatusList = await request({
      uri: `${this.address}/apiMap.html`,
      simple: true,
      json: true,
    });

    for (const regionStatus of regionsStatusList) {
      if (regionStatus.regionId === regionId) {
        return regionStatus;
      }
    }

    throw new Error('Region not found');
  }


  async getAttackerBonusRegion(regionId, countries) {
    const countriesId = (await Promise.all(countries
        .map((c) => this.getCountryInfoByName(c))
        .map((p) => p.catch((e) => ({id: 0})))))
        .map((c) => c.id);

    const region = await this.getRegionInfo(regionId);
    const bonusRegions = (await Promise.all(region.neighbours
        .map((n) => this.getRegionStatus(n))))
        .filter((s) => countriesId.includes(s.occupantId));

    const regionWithBattle = bonusRegions.find((s) => s.battle);
    if (regionWithBattle) {
      const region = await this.getRegionInfo(regionWithBattle.regionId);
      const country =
        countries[countriesId.indexOf(regionWithBattle.occupantId)];

      return `${region.name}, ${country}`;
    }

    if (bonusRegions.length) {
      const region = await this.getRegionInfo(bonusRegions[0].regionId);
      const country =
          countries[countriesId.indexOf(bonusRegions[0].occupantId)];

      return `${region.name}, ${country}`;
    }

    return null;
  }


  async getNewCitizens(countryId = 0, page = 1) {
    const $ = await request({
      uri: `${this.address}/newCitizens.html`,
      transform: (body) => cheerio.load(body),
      qs: {
        countryId,
        page,
      },
    });

    return $('table.dataTable tr td:first-child a').get()
        .map((a) => parseInt($(a).attr('href').split('=')[1]));
  }


  async getNewCitizensLastPage(countryId = 0) {
    const $ = await request({
      uri: `${this.address}/newCitizens.html`,
      transform: (body) => cheerio.load(body),
      qs: {
        countryId,
      },
    });


    const lastPageLink = $('ul#pagination-digg li:nth-last-child(2) a');
    if (!lastPageLink.length) {
      throw new Error('Link to last page not found');
    }

    return parseInt(new URLSearchParams(
        lastPageLink.attr('href').split('?')[1]).get('page'));
  }
}


mongoose.model(Server, {
  name: {
    type: String, required: true, unique: true,
    validate: {
      validator: async function(value) {
        const servers = await Server.find({
          _id: {$ne: this._id},
          name: value,
        });

        return servers.length === 0;
      },
      msg: 'Server name already exists',
    },
  },
  shortname: {
    type: String, required: true, unique: true, lowercase: true,
    validate: [{
      validator: /^[a-z]$/i,
      msg: 'Short name should be a single letter',
    }, {
      validator: async function(value) {
        const servers = await Server.find({
          _id: {$ne: this._id},
          shortname: value,
        });

        return servers.length === 0;
      },
      msg: 'Server short name already exists',
    }],
  },
  port: {type: Number, default: 80},
  countries: [{type: mongoose.Schema.Types.ObjectId, ref: 'Country'}],
  disabled: {type: Boolean, default: false},
});


module.exports = Server;
