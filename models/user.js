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


function hash(password, salt) {
  if (password === '') {
    return null;
  }

  return crypto.createHmac('sha512', salt).update(password).digest('base64');
}

function setPassword(value) {
  this.salt = crypto.randomBytes(64).toString('base64');
  return hash(value, this.salt);
}

function createConfirmCode() {
  return crypto.randomBytes(16).toString('hex');
}

var userSchema = new mongoose.Schema({
  username: {type: String, required: true, unique: true},
  password: {type: String, required: true, set: setPassword},
  salt: {type: String, required: true},
  email: {type: String, required: true, unique: true, lowercase: true},
  confirmCode: {type: String, default: createConfirmCode},
});

userSchema.methods.isValidPassword = function(password) {
  return this.password === hash(password, this.salt);
};

/* jshint -W003 */
var User = mongoose.model('User', userSchema);
/* jshint +W003 */
module.exports = User;
