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


const serverSchema = new mongoose.Schema({
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

serverSchema.virtual('address').get(function() {
  return `http://${this.name.toLowerCase()}.e-sim.org` +
    `${this.port !== 80 ? `:${this.port}` : ''}`;
});

serverSchema.methods.getCountryInfoByName = async function(countryName) {
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
};

serverSchema.methods.getRegionInfo = async function(regionId) {
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
};

serverSchema.methods.getRegionStatus = async function(regionId) {
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
};

serverSchema.methods.getAttackerBonusRegion =
async function(regionId, countries) {
  const bonusRegions = [];
  const countriesId = [];

  for (const countryName of countries) {
    let countryId;

    try {
      const country = await this.getCountryInfoByName(countryName);
      countryId = country.id;
    } catch (error) {
      countryId = 0;
    }

    countriesId.push(countryId);
  }

  const region = await this.getRegionInfo(regionId);

  for (const neighbour of region.neighbours) {
    const status = await this.getRegionStatus(neighbour);

    if (countriesId.includes(status.occupantId)) {
      if (status.battle === true) {
        const region = await this.getRegionInfo(status.regionId);
        const country = countries[countriesId.indexOf(status.occupantId)];
        return `${region.name}, ${country}`;
      }

      bonusRegions.push(status);
    }
  }

  if (bonusRegions.length) {
    const region = await this.getRegionInfo(bonusRegions[0].regionId);
    const country = countries[countriesId.indexOf(bonusRegions[0].occupantId)];
    return `${region.name}, ${country}`;
  }

  return null;
};

const Server = mongoose.model('Server', serverSchema);
module.exports = Server;
