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


const express = require('express');
const router = express.Router();

const Server = require('../models/server');
const Organization = require('../models/organization');


router.get('/:server/battle/:battleId', (req, res) => {
  Server.findOne({
    name: {$regex: new RegExp(req.params.server, 'i')},
  }).populate('countries').exec((error, server) => {
    if (error) {
      res.end(JSON.stringify({
        'error': error,
      }));
      return;
    }

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

    Organization.populate(server, {
      path: 'countries.organizations',
    }, (error, server) => {
      if (error) {
        res.end(JSON.stringify({
          'error': error,
        }));
        return;
      }

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

      server.countries[i].organizations[0].getBattleInfo(battleId,
        (error, battleInfo) => {
          if (error) {
            res.end(JSON.stringify({
              'error': error,
            }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            'type': battleInfo.type,
            'defender': battleInfo.defender,
            'attacker': battleInfo.attacker,
            'label': battleInfo.label,
            'typeId': battleInfo.id,
          }));
        });
    });
  });
});


module.exports = router;
