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


function hash(password, salt) {
  if (password === '') {
    return null;
  }

  return crypto.createHmac('sha512', salt).update(password).digest('base64');
}

function createConfirmCode() {
  return crypto.randomBytes(16).toString('hex');
}

const userSchema = new mongoose.Schema({
  username: {
    type: String, required: true, unique: true,
    validate: {
      validator: async function(value) {
        const users = await User.find({
          _id: {$ne: this._id},
          username: value,
        });

        return users.length === 0;
      },
      msg: 'Username already exists',
    },
  },
  password: {
    type: String, required: true,
    set: function(value) {
      this.salt = crypto.randomBytes(64).toString('base64');
      return hash(value, this.salt);
    },
  },
  salt: {type: String, required: true},
  email: {
    type: String, required: true, unique: true, lowercase: true,
    validate: [{
      validator: /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,4}$/i,
      msg: 'E-mail is invalid',
    }, {
      validator: async function(value) {
        const users = await User.find({
          _id: {$ne: this._id},
          email: value,
        });

        return users.length === 0;
      },
      msg: 'E-mail is already registered',
    }],
  },
  confirmCode: {type: String, default: createConfirmCode},
  recoverCode: {type: String},
  accessLevel: {type: Number, default: 1, min: 1, max: 7},
  citizens: [{
    server: {type: mongoose.Schema.Types.ObjectId, ref: 'Server'},
    name: {type: String, required: true},
  }],
  nicknames: {
    type: [String],
    validate: {
      validator: async function(value) {
        for (const nickname of value) {
          const users = await User.find({
            _id: {$ne: this._id},
            nicknames: nickname,
          });

          if (users.length) {
            return false;
          }
        }

        return true;
      },
      msg: 'Nickname is already in use',
    },
  },
});

userSchema.methods.isValidPassword = function(password) {
  return this.password === hash(password, this.salt);
};

userSchema.methods.recover = async function() {
  this.recoverCode = createConfirmCode();
  await this.save();
};

const User = mongoose.model('User', userSchema);
module.exports = User;
