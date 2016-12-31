/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2015  Arnel A. Borja <kyoushuu@yahoo.com>
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


const battleSchema = new mongoose.Schema({
  battleId: {type: Number},
  label: {type: String},
  country: {type: mongoose.Schema.Types.ObjectId, ref: 'Country'},
  channel: {type: mongoose.Schema.Types.ObjectId, ref: 'Channel'},
  side: {type: String},
  mode: {type: String, default: 'full'},
});

const Battle = mongoose.model('Battle', battleSchema);
module.exports = Battle;
