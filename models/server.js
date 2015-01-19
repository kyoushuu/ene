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
var request = require('request');


var serverSchema = new mongoose.Schema({
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
  return 'http://' + this.name.toLowerCase() + '.e-sim.org' +
    (this.port !== 80 ? ':' + this.port : '');
});

serverSchema.path('name').validate(function(value, respond) {
  Server.find({
    _id: {$ne: this._id},
    name: value,
  }, function(error, servers) {
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
  }, function(error, servers) {
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
  var self = this;

  if (!self.countriesList) {
    getCountriesList(function(error) {
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
    var l = self.countriesList.length;
    for (var i = 0; i < l; i++) {
      if (self.countriesList[i].name.toLowerCase() ===
          countryName.toLowerCase()) {
        callback(null, self.countriesList[i]);
        return;
      }
    }

    callback('Country not found');
  }

  function getCountriesList(callback) {
    var address = self.address + '/apiCountries.html';
    request(address, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        self.countriesList = JSON.parse(body);
        callback(null);
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  }
};

serverSchema.methods.getRegionInfo = function(regionId, callback) {
  var self = this;

  if (!self.regionsList) {
    getRegionsList(function(error) {
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
    var l = self.regionsList.length;
    for (var i = 0; i < l; i++) {
      if (self.regionsList[i].id === regionId) {
        callback(null, self.regionsList[i]);
        return;
      }
    }

    callback('Region not found');
  }

  function getRegionsList(callback) {
    var address = self.address + '/apiRegions.html';
    request(address, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        self.regionsList = JSON.parse(body);
        callback(null);
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  }
};

serverSchema.methods.getRegionStatus = function(regionId, callback) {
  var self = this;

  var address = self.address + '/apiMap.html';
  request(address, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var regionsStatusList = JSON.parse(body);

      var l = regionsStatusList.length;
      for (var i = 0; i < l; i++) {
        if (regionsStatusList[i].regionId === regionId) {
          callback(null, regionsStatusList[i]);
          return;
        }
      }

      callback('Region not found');
    } else {
      callback(error || 'HTTP Error: ' + response.statusCode);
    }
  });
};

/* jshint -W003 */
var Server = mongoose.model('Server', serverSchema);
/* jshint +W003 */
module.exports = Server;
