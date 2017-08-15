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


const express = require('express');
const router = express.Router();

const {ensureSignedIn, asyncWrap} = require('./common');

const Server = require('../models/server');


router.route('/new').get(ensureSignedIn, (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  res.render('server-create', {title: 'Create Server'});
}).post(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  try {
    const server = await Server.create({
      name: req.body.name,
      shortname: req.body.shortname,
      port: req.body.port,
    });

    req.flash('info', 'Server successfully created');
    res.redirect(`/server/${server.id}`);
  } catch (error) {
    res.render('server-create', {
      title: 'Create Server',
      error: error,
      name: req.body.name,
      shortname: req.body.shortname,
      port: req.body.port,
    });
  }
}));


router.get('/:serverId', ensureSignedIn, asyncWrap(async (req, res) => {
  const server = await Server.findById(req.params.serverId);
  if (!server) {
    res.sendStatus(404);
    return;
  }

  res.render('server', {
    title: 'Server Information',
    server: server,
    info: req.flash('info'),
  });
}));


router.route('/edit/:serverId').get(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  const server = await Server.findById(req.params.serverId);
  if (!server) {
    res.sendStatus(404);
    return;
  }

  res.render('server-edit', {
    title: 'Edit Server',
    server: server,
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  const server = await Server.findById(req.params.serverId);
  if (!server) {
    res.sendStatus(404);
    return;
  }

  server.name = req.body.name;
  server.shortname = req.body.shortname;
  server.port = req.body.port;

  try {
    await server.save();

    req.flash('info', 'Server successfully saved');
    res.redirect(`/server/${server.id}`);
  } catch (error) {
    res.render('server-edit', {
      title: 'Edit Server',
      error: error,
      server: server,
    });
  }
}));


module.exports = router;
