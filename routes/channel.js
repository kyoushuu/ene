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

const Channel = require('../models/channel');


router.route('/new').get(ensureSignedIn, (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  res.render('channel-create', {
    title: 'Create Channel',
  });
}).post(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  try {
    const channel = await Channel.create({
      name: req.body.name,
      keyword: req.body.keyword,
    });

    req.flash('info', 'Channel successfully created');
    res.redirect(`/channel/${channel.id}`);
  } catch (error) {
    res.render('channel-create', {
      title: 'Create Channel',
      error: error,
      name: req.body.name,
    });
  }
}));


router.get('/:channelId', ensureSignedIn, asyncWrap(async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.channelId);

    res.render('channel', {
      title: 'Channel Information',
      channel: channel,
      info: req.flash('info'),
    });
  } catch (error) {
    res.sendStatus(404);
  }
}));


module.exports = router;
