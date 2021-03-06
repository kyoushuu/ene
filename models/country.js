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


import mongoose from 'mongoose';
import moment from 'moment-timezone';


class Country extends mongoose.Model {
  getUserAccessLevel(user) {
    const l = this.accessList.length;
    for (let i = 0; i < l; i++) {
      const accountId = this.accessList[i].account._id ||
        this.accessList[i].account;

      if (accountId.equals(user._id)) {
        return this.accessList[i].accessLevel;
      }
    }

    return 0;
  }


  /* eslint-disable class-methods-use-this */
  getDayStart() {
    return moment().tz('Europe/Warsaw').startOf('day').unix();
  }
  /* eslint-enable class-methods-use-this */
}


mongoose.model(Country, {
  server: {type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true},
  name: {
    type: String, required: true,
    validate: {
      validator: async function(value) {
        const countries = await Country.find({
          _id: {$ne: this._id},
          name: value,
          server: this.server,
        });

        return countries.length === 0;
      },
      msg: 'Country name with the same server already exists',
    },
  },
  shortname: {
    type: String, required: true, lowercase: true,
    validate: [{
      validator: /^[a-z]{2}$/i,
      msg: 'Short name should be two letters',
    }, {
      validator: async function(value) {
        const countries = await Country.find({
          _id: {$ne: this._id},
          shortname: value,
          server: this.server,
        });

        return countries.length === 0;
      },
      msg: 'Country short name with the same server already exists',
    }],
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


export default Country;
