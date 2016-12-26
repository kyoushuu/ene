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

const common = require('./common');

const Organization = require('../models/organization');
const Country = require('../models/country');
const Server = require('../models/server');


router.route('/new').get(common.ensureSignedIn, function(req, res) {
  const query = Server.find({}, null, {sort: {_id: 1}});
  query.populate('countries', null, null, {sort: {_id: 1}});
  query.exec(function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('organization-create', {
      title: 'Create Organization',
      servers: servers,
    });
  });
}).post(common.ensureSignedIn, function(req, res) {
  const query = Country.findById(req.body.country).populate('server');
  query.exec(function(error, country) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!country) {
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

    organization.login(function(error) {
      if (error) {
        doCreateFailed(req, res, `Failed to login: ${error}`);
        return;
      }

      organization.save(function(error) {
        if (error) {
          doCreateFailed(req, res, `Failed to save organization: ${error}`);
          return;
        }

        country.organizations.push(organization);
        country.save(function(error) {
          if (error) {
            doCreateFailed(req, res, `Failed to save country: ${error}`);
            return;
          }

          req.flash('info', 'Organization successfully created');
          res.redirect(`/organization/${organization.id}`);
        });
      });
    });
  });
});

function doCreateFailed(req, res, err) {
  const query = Server.find({}, null, {sort: {_id: 1}});
  query.populate('countries', null, null, {sort: {_id: 1}});
  query.exec(function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('organization-create', {
      title: 'Create Organization',
      servers: servers,
      error: err,
      username: req.body.username,
      shortname: req.body.shortname,
      country: req.body.country,
    });
  });
}


router.get('/:organizationId', common.ensureSignedIn, function(req, res) {
  const query = Organization.findById(req.params.organizationId);
  query.populate('country');
  query.exec(function(error, organization) {
    if (error || !organization) {
      res.sendStatus(404);
      return;
    } else if (!organization.country || !organization.country._id) {
      res.status(404).send('Country Not Found');
      return;
    }

    Server.populate(organization, {
      path: 'country.server',
    }, function(error, organization) {
      if (error) {
        console.log(error);
        res.sendStatus(500);
        return;
      } else if (!organization.country.server ||
          !organization.country.server._id) {
        res.status('Server Not Found', 404);
        return;
      }

      res.render('organization', {
        title: 'Organization Information',
        organization: organization,
        info: req.flash('info'),
      });
    });
  });
});


router.route('/edit/:organizationId').get(common.ensureSignedIn,
function(req, res) {
  const query = Organization.findById(req.params.organizationId);
  query.exec(function(error, organization) {
    if (error || !organization) {
      res.sendStatus(404);
      return;
    }

    res.render('organization-edit', {
      title: 'Edit Organization',
      organization: organization,
    });
  });
}).post(common.ensureSignedIn, function(req, res) {
  const query = Organization.findById(req.params.organizationId);
  query.populate('country');
  query.exec(function(error, organization) {
    if (error || !organization) {
      res.sendStatus(404);
      return;
    }

    const country = organization.country;

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

    organization.login(function(error) {
      if (error) {
        doEditFailed(res, error, organization);
        return;
      }

      organization.save(function(error) {
        if (error) {
          doEditFailed(res, error, organization);
          return;
        }

        req.flash('info', 'Organization successfully saved');
        res.redirect(`/organization/${organization.id}`);
      });
    });
  });
});

function doEditFailed(res, error, organization) {
  res.render('organization-edit', {
    title: 'Edit Organization',
    error: error,
    organization: organization,
  });
}


module.exports = router;
