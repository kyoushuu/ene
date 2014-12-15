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


var productDonationSchema = new mongoose.Schema({
  organization: {type: mongoose.Schema.Types.ObjectId, ref: 'Organization'},
  sender: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  recipient: {type: Number},
  product: {type: String},
  quantity: {type: Number},
  reason: {type: String},
});

/* jshint -W003 */
var ProductDonation = mongoose.model('ProductDonation', productDonationSchema);
/* jshint +W003 */
module.exports = ProductDonation;
