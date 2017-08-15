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

const Organization = require('../models/organization');
const Country = require('../models/country');
const Server = require('../models/server');


router.route('/new').get(ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Server.find({}, null, {sort: {_id: 1}});
  query.populate('countries', null, null, {sort: {_id: 1}});
  const servers = await query.exec();
  if (!servers || !servers.length) {
    res.status(404).send('No Servers Found');
    return;
  }

  res.render('organization-create', {
    title: 'Create Organization',
    servers: servers,
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Country.findById(req.body.country).populate('server');
  const country = await query.exec();
  if (!country) {
    res.status(404).send('Country Not Found');
    return;
  }

  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  const organization = new Organization({
    username: req.body.username,
    password: req.body.password,
    shortname: req.body.shortname,
    country: country._id,
  });

  try {
    await organization.login();
    await organization.save();

    country.organizations.push(organization);
    await country.save();

    req.flash('info', 'Organization successfully created');
    res.redirect(`/organization/${organization.id}`);
  } catch (error) {
    const query = Server.find({}, null, {sort: {_id: 1}});
    query.populate('countries', null, null, {sort: {_id: 1}});
    const servers = await query.exec();
    if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('organization-create', {
      title: 'Create Organization',
      servers: servers,
      error: error,
      username: req.body.username,
      shortname: req.body.shortname,
      country: req.body.country,
    });
  }
}));


router.get('/:organizationId', ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Organization.findById(req.params.organizationId);
  query.populate('country');
  const organization = await query.exec();

  if (!organization) {
    res.sendStatus(404);
    return;
  } else if (!organization.country || !organization.country._id) {
    res.status(404).send('Country Not Found');
    return;
  }

  await Server.populate(organization, {
    path: 'country.server',
  });

  if (!organization.country.server ||
      !organization.country.server._id) {
    res.status('Server Not Found', 404);
    return;
  }

  res.render('organization', {
    title: 'Organization Information',
    organization: organization,
    info: req.flash('info'),
  });
}));


router.route('/edit/:organizationId').get(ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Organization.findById(req.params.organizationId);
  const organization = await query.exec();

  if (!organization) {
    res.sendStatus(404);
    return;
  }

  res.render('organization-edit', {
    title: 'Edit Organization',
    organization: organization,
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  const query = Organization.findById(req.params.organizationId);
  query.populate('country');
  const organization = await query.exec();

  if (!organization) {
    res.sendStatus(404);
    return;
  }

  const {country} = organization;

  if (req.user.accessLevel < 6 && country.getUserAccessLevel(req.user) < 3) {
    res.sendStatus(403);
    return;
  }

  organization.username = req.body.username;
  organization.shortname = req.body.shortname;
  organization.lock = null;

  if (req.body.password) {
    organization.password = req.body.password;
  }

  try {
    await organization.login();
    await organization.save();

    req.flash('info', 'Organization successfully saved');
    res.redirect(`/organization/${organization.id}`);
  } catch (error) {
    res.render('organization-edit', {
      title: 'Edit Organization',
      error: error,
      organization: organization,
    });
  }
}));


module.exports = router;
