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

const {hashValue, createRandomHex, createSalt} = require('../utils/crypto');


const createConfirmCode = () => createRandomHex(16);


class User extends mongoose.Model {
  isValidPassword(password) {
    return this.password === hashValue(password, this.salt);
  }


  async recover() {
    this.recoverCode = createConfirmCode();
    await this.save();
  }
}


mongoose.model(User, {
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
      this.salt = createSalt();
      return hashValue(value, this.salt);
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
        const users = await Promise.all(value.map((nickname) => User.find({
          _id: {$ne: this._id},
          nicknames: nickname,
        })));

        if (users.reduce((a, b) => a.concat(b), []).length) {
          return false;
        }

        return true;
      },
      msg: 'Nickname is already in use',
    },
  },
});


module.exports = User;
