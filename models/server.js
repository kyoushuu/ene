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
const request = require('request');


const serverSchema = new mongoose.Schema({
  name: {type: String, required: true, unique: true},
  shortname: {
    type: String, required: true, unique: true, lowercase: true,
    validate: {
      validator: /^[a-z]$/i,
      msg: 'Short name should be a single letter',
    },
  },
  port: {type: Number, default: 80},
  countries: [{type: mongoose.Schema.Types.ObjectId, ref: 'Country'}],
  disabled: {type: Boolean, default: false},
});

serverSchema.virtual('address').get(function() {
  return `http://${this.name.toLowerCase()}.e-sim.org` +
    `${this.port !== 80 ? `:${this.port}` : ''}`;
});

serverSchema.path('name').validate(function(value, respond) {
  Server.find({
    _id: {$ne: this._id},
    name: value,
  }, (error, servers) => {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (servers.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Server name already exists');

serverSchema.path('shortname').validate(function(value, respond) {
  Server.find({
    _id: {$ne: this._id},
    shortname: value,
  }, (error, servers) => {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (servers.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Server short name already exists');

serverSchema.methods.getCountryInfoByName = function(countryName, callback) {
  const self = this;

  if (!self.countriesList) {
    getCountriesList((error) => {
      if (error) {
        callback(error);
        return;
      }

      getCountryInfoByName();
    });
    return;
  }

  getCountryInfoByName();

  function getCountryInfoByName() {
    const l = self.countriesList.length;
    for (let i = 0; i < l; i++) {
      if (self.countriesList[i].name.toLowerCase() ===
          countryName.toLowerCase()) {
        callback(null, self.countriesList[i]);
        return;
      }
    }

    callback('Country not found');
  }

  function getCountriesList(callback) {
    const address = `${self.address}/apiCountries.html`;
    request(address, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        self.countriesList = JSON.parse(body);
        callback(null);
      } else {
        callback(error || `HTTP Error: ${response.statusCode}`);
      }
    });
  }
};

serverSchema.methods.getRegionInfo = function(regionId, callback) {
  const self = this;

  if (!self.regionsList) {
    getRegionsList((error) => {
      if (error) {
        callback(error);
        return;
      }

      getRegionInfo();
    });
    return;
  }

  getRegionInfo();

  function getRegionInfo() {
    const l = self.regionsList.length;
    for (let i = 0; i < l; i++) {
      if (self.regionsList[i].id === regionId) {
        callback(null, self.regionsList[i]);
        return;
      }
    }

    callback('Region not found');
  }

  function getRegionsList(callback) {
    const address = `${self.address}/apiRegions.html`;
    request(address, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        self.regionsList = JSON.parse(body);
        callback(null);
      } else {
        callback(error || `HTTP Error: ${response.statusCode}`);
      }
    });
  }
};

serverSchema.methods.getRegionStatus = function(regionId, callback) {
  const self = this;

  const address = `${self.address}/apiMap.html`;
  request(address, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      try {
        const regionsStatusList = JSON.parse(body);

        const l = regionsStatusList.length;
        for (let i = 0; i < l; i++) {
          if (regionsStatusList[i].regionId === regionId) {
            callback(null, regionsStatusList[i]);
            return;
          }
        }

        callback('Region not found');
      } catch (e) {
        console.log(`Error: ${e}`);
        console.log(`Stack: ${e.stack}`);
        console.log(`Address: ${address}`);
        callback('Internal Error Occured');
      }
    } else {
      callback(error || `HTTP Error: ${response.statusCode}`);
    }
  });
};

serverSchema.methods.getAttackerBonusRegion =
function(regionId, countries, callback) {
  const self = this;

  const bonusRegions = [];
  const countriesId = [];

  getCountriesId(0);

  function getCountriesId(i) {
    if (i >= countries.length) {
      self.getRegionInfo(regionId, (error, region) => {
        if (error) {
          callback(`Failed to lookup region information: ${error}`);
          return;
        }

        checkBonusRegion(region.neighbours, 0);
      });

      return;
    }

    self.getCountryInfoByName(countries[i], (error, country) => {
      countriesId.push(error ? 0 : country.id);
      getCountriesId(++i);
    });
  }

  function checkBonusRegion(neighbours, i) {
    if (i >= neighbours.length) {
      if (bonusRegions.length) {
        getFullName(bonusRegions[0],
                    countries[countriesId.indexOf(bonusRegions[0].occupantId)]);
      } else {
        callback(null, null);
      }

      return;
    }

    self.getRegionStatus(neighbours[i], (error, status) => {
      if (error) {
        callback(`Failed to lookup region status: ${error}`);
        return;
      }

      if (countriesId.includes(status.occupantId)) {
        if (status.battle === true) {
          getFullName(status,
                      countries[countriesId.indexOf(status.occupantId)]);
          return;
        }

        bonusRegions.push(status);
      }

      checkBonusRegion(neighbours, ++i);
    });
  }

  function getFullName(regionStatus, country) {
    self.getRegionInfo(regionStatus.regionId, (error, region) => {
      if (error) {
        callback(`Failed to lookup region information: ${error}`);
        return;
      }

      callback(null, `${region.name}, ${country}`);
    });
  }
};

const Server = mongoose.model('Server', serverSchema);
module.exports = Server;
