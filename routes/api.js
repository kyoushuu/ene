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


import express from 'express';
const router = express.Router();

import {asyncWrap} from './common';

import Server from '../models/server';
import Organization from '../models/organization';


router.get('/:server/battle/:battleId', asyncWrap(async (req, res) => {
  try {
    const server = await Server.findOne({
      name: {$regex: new RegExp(req.params.server, 'i')},
    }).populate('countries').exec();

    if (!server) {
      res.end(JSON.stringify({
        'error': 'Server not found',
      }));
      return;
    }

    if (server.disabled) {
      res.end(JSON.stringify({
        'error': 'Server is disabled',
      }));
      return;
    }

    await Organization.populate(server, {
      path: 'countries.organizations',
    });

    const battleId = parseInt(req.params.battleId);
    if (isNaN(battleId) || battleId < 1) {
      res.end(JSON.stringify({
        'error': 'Invalid battle id',
      }));
      return;
    }

    if (!server.countries.length) {
      return;
    }

    let i;
    const l = server.countries.length;
    for (i = 0; i < l; i++) {
      if (server.countries[i].organizations.length) {
        break;
      }
    }

    if (i === l) {
      return;
    }

    const battleInfo =
      await server.countries[i].organizations[0].getBattleInfo(battleId);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      'type': battleInfo.type,
      'defender': battleInfo.defender,
      'attacker': battleInfo.attacker,
      'label': battleInfo.label,
      'typeId': battleInfo.id,
    }));
  } catch (error) {
    res.end(JSON.stringify({
      'error': error,
    }));
  }
}));


export default router;
