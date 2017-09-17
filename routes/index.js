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


import express from 'express';
const router = express.Router();

import {asyncWrap} from './common';

import Country from '../models/country';

/* GET home page. */
router.get('/', asyncWrap(async (req, res) => {
  if (!req.user) {
    res.render('index', {title: 'Ene Project'});
    return;
  }

  const countries = await Country.find(req.user.accessLevel < 4 ? {
    'accessList.account': req.user,
  } : {}).populate('server').exec();

  res.render('index', {
    title: 'Ene Project',
    user: req.user,
    countries: countries,
  });
}));

export default router;
