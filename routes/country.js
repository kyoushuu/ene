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

import {ensureSignedIn, asyncWrap} from './common';

import Server from '../models/server';
import Country from '../models/country';
import User from '../models/user';
import Channel from '../models/channel';


router.route('/new').get(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  const servers = await Server.find({}, null, {sort: {_id: 1}});
  if (!servers || servers.length < 1) {
    res.status(404).send('No Servers Found');
    return;
  }

  res.render('country-create', {
    title: 'Create Country',
    servers: servers,
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  const server = await Server.findById(req.body.server);
  if (!server) {
    res.status(404).send('Server Not Found');
    return;
  }

  try {
    const country = await Country.create({
      name: req.body.name,
      shortname: req.body.shortname,
      server: server._id,
    });

    server.countries.push(country);
    await server.save();

    req.flash('info', 'Country successfully created');
    res.redirect(`/country/${country.id}`);
  } catch (error) {
    const servers = await Server.find({}, null, {sort: {_id: 1}});
    if (!servers || servers.length < 1) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('country-create', {
      title: 'Create Country',
      servers: servers,
      error: error,
      name: req.body.name,
      shortname: req.body.shortname,
      server: req.body.server,
    });
  }
}));


router.get('/:countryId', ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Country.findById(req.params.countryId);
  const country = await query.populate('server organizations').exec();
  if (!country) {
    res.sendStatus(404);
    return;
  }

  res.render('country', {
    title: 'Country Information',
    country: country,
    info: req.flash('info'),
  });
}));


router.get('/:countryId/access', ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Country.findById(req.params.countryId);
  const country = await query.populate('accessList.account').exec();
  if (!country) {
    res.sendStatus(404);
    return;
  }

  /* Only site and country admins could get access list */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  res.render('country-access', {
    title: 'Country Access List',
    country: country,
    info: req.flash('info'),
    error: req.flash('error'),
  });
}));


function doAddAccessFailed(req, res, err) {
  res.render('country-access-add', {
    title: 'New Country Access',
    error: err,
    username: req.body.username,
    accessLevel: req.body.accessLevel,
  });
}

router.route('/:countryId/access/new').get(ensureSignedIn, asyncWrap(async (req, res) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  /* Only site and country admins could change access */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  res.render('country-access-add', {
    title: 'New Country Access',
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  const user = await User.findOne({username: req.body.username});
  if (!user) {
    doAddAccessFailed(req, res, 'Username not found');
    return;
  }

  let access = null;
  let accessLevel = 0;
  const l = country.accessList.length;
  for (let i = 0; i < l; i++) {
    if (country.accessList[i].account.equals(req.user._id)) {
      ({accessLevel} = country.accessList[i]);
    }

    if (country.accessList[i].account.equals(user._id)) {
      access = country.accessList[i];
    }
  }

  /* Only site and country admins could change access */
  if (req.user.accessLevel < 6 && accessLevel < 3) {
    res.sendStatus(403);
    return;
  }

  /* Only site admins could add country admins */
  if (req.user.accessLevel < 6 && req.body.accessLevel >= 3) {
    res.sendStatus(403);
    return;
  }

  if (access) {
    /* Prevent country admins to remove another country admin */
    if (req.user.accessLevel < 6 && access.accessLevel >= 3) {
      res.sendStatus(403);
      return;
    }

    access.accessLevel = req.body.accessLevel;
  } else {
    country.accessList.push({
      account: user._id,
      accessLevel: req.body.accessLevel,
    });
  }

  try {
    await country.save();

    req.flash('info', 'Access successfully added');
    res.redirect(`/country/${country.id}/access`);
  } catch (error) {
    doAddAccessFailed(req, res, error);
  }
}));


router.get('/:countryId/access/remove/:accessId', ensureSignedIn, asyncWrap(async (req, res) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  const access = country.accessList.id(req.params.accessId);
  if (!access) {
    req.flash('error', 'Access not found');
    res.redirect(`/country/${country.id}/access`);
    return;
  }

  /* Only site and country admins could remove access */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  /* Only site admins could remove country admins */
  if (req.user.accessLevel < 6 && access.accessLevel >= 3) {
    res.sendStatus(403);
    return;
  }

  access.remove();

  try {
    await country.save();

    req.flash('info', 'Access successfully removed');
    res.redirect(`/country/${country.id}/access`);
  } catch (error) {
    doAddAccessFailed(req, res, error);
  }
}));


router.get('/:countryId/channel', ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Country.findById(req.params.countryId);
  const country = await query.populate('channels.channel').exec();
  if (!country) {
    res.sendStatus(404);
    return;
  }

  /* Only site and country admins could get channel list */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  res.render('country-channel', {
    title: 'Country Channels',
    country: country,
    info: req.flash('info'),
    error: req.flash('error'),
  });
}));


function doAddChannelFailed(req, res, error) {
  res.render('country-channel-add', {
    title: 'New Country Channel',
    error: error,
    name: req.body.name,
    general: req.body.general,
    military: req.body.military,
    political: req.body.political,
    motivation: req.body.motivation,
  });
}

router.route('/:countryId/channel/new').get(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  res.render('country-channel-add', {
    title: 'New Country Channel',
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  /* Only site and country admins could add channels */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  const channel = await Channel.findOne({name: req.body.name});
  if (!channel) {
    doAddChannelFailed(req, res, 'Channel not found');
    return;
  }

  const l = country.channels.length;
  for (let i = 0; i < l; i++) {
    if (country.channels[i].channel.equals(channel._id)) {
      doAddChannelFailed(req, res, 'Channel already exists');
      return;
    }
  }

  const types = [];

  if (req.body.general) {
    types.push('general');
  }

  if (req.body.military) {
    types.push('military');
  }

  if (req.body.political) {
    types.push('political');
  }

  if (req.body.motivation) {
    types.push('motivation');
  }

  if (types.length < 1) {
    doAddChannelFailed(req, res, 'No type selected');
    return;
  }

  country.channels.push({
    channel: channel._id,
    types: types,
  });

  try {
    await country.save();

    channel.countries.push(country._id);

    await channel.save();

    req.flash('info', 'Channel successfully added');
    res.redirect(`/country/${country.id}`);
  } catch (error) {
    doAddChannelFailed(req, res, error);
  }
}));


router.get('/:countryId/channel/remove/:channelId', ensureSignedIn, asyncWrap(async (req, res) => {
  const country = await Country.findById(req.params.countryId);
  if (!country) {
    res.sendStatus(404);
    return;
  }

  const _channel = country.channels.id(req.params.channelId);
  if (!_channel) {
    req.flash('error', 'Channel not found in country');
    res.redirect(`/country/${country.id}/channel`);
    return;
  }

  const channel = await Channel.findById(_channel.channel);
  if (!channel) {
    res.sendStatus(404);
    return;
  }

  const countryId = channel.countries.indexOf(country.id);
  if (countryId < 0) {
    req.flash('error', 'Country not found in channel');
    res.redirect(`/country/${country.id}/channel`);
    return;
  }

  /* Only site and country admins could remove channels */
  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  _channel.remove();
  channel.countries.splice(countryId, 1);

  try {
    await country.save();

    await channel.save();

    req.flash('info', 'Channel successfully removed');
    res.redirect(`/country/${country.id}/channel`);
  } catch (error) {
    doAddChannelFailed(req, res, error);
  }
}));


export default router;
