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

function cipherValue(value) {
  if (!value) {
    return null;
  }

  var cipher = crypto.createCipher('aes-256-cbc', secret);
  return cipher.update(value, 'binary', 'base64') + cipher.final('base64');
}

function decipherValue(value) {
  if (!value) {
    return null;
  }

  var decipher = crypto.createDecipher('aes-256-cbc', secret);
  return decipher.update(value, 'base64', 'binary') + decipher.final('binary');
}

var channelSchema = new mongoose.Schema({
  name: {type: String, required: true, unique: true},
  keyword: {type: String, get: decipherValue, set: cipherValue},
  countries: [{type: mongoose.Schema.Types.ObjectId, ref: 'Country'}],
});

channelSchema.path('name').validate(function(value, respond) {
  Channel.find({
    _id: {$ne: this._id},
    name: value,
  }, function(error, channels) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (channels.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Channel name already exists');

/* jshint -W003 */
var Channel = mongoose.model('Channel', channelSchema);
/* jshint +W003 */
module.exports = Channel;
