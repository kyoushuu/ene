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

const {cipherValue, decipherValue} = require('../utils/crypto');


class Channel extends mongoose.Model {
}


mongoose.model(Channel, {
  name: {
    type: String, required: true, unique: true,
    validate: {
      validator: async function(value) {
        const channels = await Channel.find({
          _id: {$ne: this._id},
          name: value,
        });

        return channels.length === 0;
      },
      msg: 'Channel name already exists',
    },
  },
  keyword: {type: String, get: decipherValue, set: cipherValue},
  countries: [{type: mongoose.Schema.Types.ObjectId, ref: 'Country'}],
});


module.exports = Channel;
