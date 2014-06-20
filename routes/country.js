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


var Server = require('../models/server');
var Country = require('../models/country');


exports.create = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.send(403);
    return;
  }

  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!servers || servers.length < 1) {
      res.send('No Servers Found', 404);
      return;
    }

    res.render('country-create', {
      title: 'Create Country',
      servers: servers,
    });
  });
};


exports.doCreate = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.send(403);
    return;
  }

  Server.findById(req.body.server, function(error, server) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!server) {
      res.send('Server Not Found', 404);
      return;
    }

    Country.create({
      name: req.body.name,
      shortname: req.body.shortname,
      server: server._id,
    }, function(error, country) {
      if (error) {
        doCreateFailed(req, res, error);
        return;
      }

      req.flash('info', 'Country successfully created');
      res.redirect('/country/' + country.id);
    });
  });
};

function doCreateFailed(req, res, err) {
  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!servers || servers.length < 1) {
      res.send('No Servers Found', 404);
      return;
    }

    res.render('country-create', {
      title: 'Create Country',
      servers: servers,
      error: err,
      name: req.body.name,
      shortname: req.body.shortname,
      server: req.body.server,
    });
  });
}
