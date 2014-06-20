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
var crypto = require('crypto');


var secret = process.env.SECRET_KEY || process.env.OPENSHIFT_SECRET_TOKEN;

var organizationSchema = new mongoose.Schema({
  country: {type: mongoose.Schema.Types.ObjectId, ref: 'Country'},
  username: {type: String, required: true},
  password: {
    type: String,
    required: true,
    get: function(value) {
      var decipher = crypto.createDecipher('aes-256-cbc', secret);
      return decipher.update(value, 'hex', 'binary') + decipher.final('binary');
    },
    set: function(value) {
      var cipher = crypto.createCipher('aes-256-cbc', secret);
      return cipher.update(value, 'binary', 'hex') + cipher.final('hex');
    },
  },
  shortname: {
    type: String, required: true, lowercase: true,
    validate: {
      validator: /^[a-z]{2,3}$/i,
      msg: 'Short username should be two or three letters',
    },
  },
});

organizationSchema.path('username').validate(function(value, respond) {
  Organization.find({
    _id: {$ne: this._id},
    username: value,
    country: this.country,
  }, function(error, organizations) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (organizations.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Organization username with the same country already exists');

organizationSchema.path('shortname').validate(function(value, respond) {
  Organization.find({
    _id: {$ne: this._id},
    shortname: value,
    country: this.country,
  }, function(error, organizations) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (organizations.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Organization short username with the same country already exists');

/* jshint -W003 */
var Organization = mongoose.model('Organization', organizationSchema);
/* jshint +W003 */
module.exports = Organization;
