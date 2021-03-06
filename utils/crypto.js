/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2017  Arnel A. Borja <kyoushuu@yahoo.com>
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


import crypto from 'crypto';


const secret = process.env.SECRET_KEY || 'secret';


function cipherValue(value) {
  if (!value) {
    return null;
  }

  const cipher = crypto.createCipher('aes-256-cbc', secret);
  return cipher.update(value, 'binary', 'base64') + cipher.final('base64');
}

function decipherValue(value) {
  if (!value) {
    return null;
  }

  const decipher = crypto.createDecipher('aes-256-cbc', secret);
  return decipher.update(value, 'base64', 'binary') + decipher.final('binary');
}

function hashValue(value, salt) {
  if (!value) {
    return null;
  }

  return crypto.createHmac('sha512', salt).update(value).digest('base64');
}

function createRandomHex(bytesLength) {
  return crypto.randomBytes(bytesLength).toString('hex');
}

function createSalt() {
  return crypto.randomBytes(64).toString('base64');
}


export {
  secret,
  cipherValue,
  decipherValue,
  hashValue,
  createRandomHex,
  createSalt,
};
