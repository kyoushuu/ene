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


var express = require('express');
var router = express.Router();

var Server = require('../models/server');


router.get('/battle/:server/:battleId', function(req, res) {
  Server.find({
    name: {$regex: new RegExp(req.params.server, 'i')},
  }).populate('countries').exec(function(error, server) {
    if (error) {
      res.end(JSON.stringify({
        'error': error,
      }));
      return;
    }

    var query = server.countries[0].populate('organizations');
    query.exec(function(error, country) {
      if (error) {
        res.end(JSON.stringify({
          'error': error,
        }));
        return;
      }

      var battleId = parseInt(req.params.battleId);
      if (isNaN(battleId) || battleId < 1) {
        res.end(JSON.stringify({
          'error': 'Invalid battle id',
        }));
        return;
      }

      country.organizations[0].getBattleInfo(battleId,
        function(error, battleInfo) {
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
