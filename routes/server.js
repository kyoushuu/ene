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


var express = require('express');
var router = express.Router();

var Server = require('../models/server');


router.route('/new').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  res.render('server-create', {title: 'Create Server'});
}).post(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  Server.create({
    name: req.body.name,
    shortname: req.body.shortname,
  }, function(error, server) {
    if (error) {
      res.render('server-create', {
        title: 'Create Server',
        error: error,
        name: req.body.name,
        shortname: req.body.shortname,
      });
      return;
    }

    req.flash('info', 'Server successfully created');
    res.redirect('/server/' + server.id);
  });
});


router.get('/:serverId', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  Server.findById(req.params.serverId, function(error, server) {
    if (error || !server) {
      res.sendStatus(404);
      return;
    }

    res.render('server', {
      title: 'Server Information',
      server: server,
      info: req.flash('info'),
    });
  });
});


router.route('/edit/:serverId').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  Server.findById(req.params.serverId, function(error, server) {
    if (error || !server) {
      res.sendStatus(404);
      return;
    }

    res.render('server-edit', {
      title: 'Edit Server',
      server: server,
    });
  });
}).post(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  Server.findById(req.params.serverId, function(error, server) {
    if (error || !server) {
      res.sendStatus(404);
      return;
    }

    server.name = req.body.name;
    server.shortname = req.body.shortname;

    server.save(function(error) {
      if (error) {
        res.render('server-edit', {
          title: 'Edit Server',
          error: error,
          server: server,
        });
        return;
      }

      req.flash('info', 'Server successfully saved');
      res.redirect('/server/' + server.id);
    });
  });
});


module.exports = router;
