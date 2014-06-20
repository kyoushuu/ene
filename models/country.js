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

/* jshint -W003 */
var Country = mongoose.model('Country', countrySchema);
/* jshint +W003 */
module.exports = Country;
