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


const productDonationSchema = new mongoose.Schema({
  organization: {type: mongoose.Schema.Types.ObjectId, ref: 'Organization'},
  sender: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  recipient: {type: Number},
  product: {type: String},
  quantity: {type: Number},
  reason: {type: String},
});

const ProductDonation =
  mongoose.model('ProductDonation', productDonationSchema);
module.exports = ProductDonation;
