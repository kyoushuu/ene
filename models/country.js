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


var countrySchema = new mongoose.Schema({
  server: {type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true},
  name: {type: String, required: true},
  shortname: {
    type: String, required: true, lowercase: true,
    validate: {
      validator: /^[a-z]{2}$/i,
      msg: 'Short name should be two letters',
    },
  },
  accessList: [{
    account: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    accessLevel: {type: Number, default: 1, min: 1, max: 3},
  }],
  organizations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
  }],
  channels: [{
    channel: {type: mongoose.Schema.Types.ObjectId, ref: 'Channel'},
    types: [{
      type: String,
      enum: ['general', 'military', 'political', 'motivation'],
    }],
  }],
  supplyFormat: {
    type: String,
    default: '1-WEAPON/5-FOOD/5-GIFT/1-TICKET/3-FOOD',
  },
});

countrySchema.path('name').validate(function(value, respond) {
  Country.find({
    _id: {$ne: this._id},
    name: value,
    server: this.server,
  }, function(error, countries) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (countries.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Country name with the same server already exists');

countrySchema.path('shortname').validate(function(value, respond) {
  Country.find({
    _id: {$ne: this._id},
    shortname: value,
    server: this.server,
  }, function(error, countries) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (countries.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Country short name with the same server already exists');

countrySchema.methods.getUserAccessLevel = function(user) {
  var self = this;

  var accessLevel = 0;
  var l = self.accessList.length;
  for (var i = 0; i < l; i++) {
    var accountId = self.accessList[i].account._id ||
      self.accessList[i].account;

    if (accountId.equals(user._id)) {
      accessLevel = self.accessList[i].accessLevel;
      break;
    }
  }

  return accessLevel;
};

/* jshint -W003 */
var Country = mongoose.model('Country', countrySchema);
/* jshint +W003 */
module.exports = Country;
