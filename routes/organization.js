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


var Organization = require('../models/organization');
var Country = require('../models/country');
var Server = require('../models/server');


exports.create = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Server.find({}, null, {sort: {_id: 1}});
  query.populate('countries', null, null, {sort: {_id: 1}});
  query.exec(function(error, servers) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!servers || !servers.length) {
      res.send('No Servers Found', 404);
      return;
    }

    res.render('organization-create', {
      title: 'Create Organization',
      servers: servers,
    });
  });
};


exports.doCreate = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Country.findById(req.body.country).populate('server');
  query.exec(function(error, country) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!country) {
      res.send('Country Not Found', 404);
      return;
    }

    var accessLevel = 0;
    var l = country.accessList.length;
    for (var i = 0; i < l; i++) {
      if (country.accessList[i].account.equals(req.user._id)) {
        accessLevel = country.accessList[i].accessLevel;
      }
    }

    if (req.user.accessLevel < 6 && accessLevel < 3) {
      res.send(403);
      return;
    }

    var organization = new Organization({
      username: req.body.username,
      password: req.body.password,
      shortname: req.body.shortname,
      country: country._id,
    });

    organization.login(function(error) {
      if (error) {
        doCreateFailed(req, res, error);
        return;
      }

      organization.save(function(error) {
        if (error) {
          doCreateFailed(req, res, error);
          return;
        }

        country.organizations.push(organization);
        country.save(function(error) {
          if (error) {
            doCreateFailed(req, res, error);
            return;
          }

          req.flash('info', 'Organization successfully created');
          res.redirect('/organization/' + organization.id);
        });
      });
    });
  });
};

function doCreateFailed(req, res, err) {
  var query = Server.find({}, null, {sort: {_id: 1}});
  query.populate('countries', null, null, {sort: {_id: 1}});
  query.exec(function(error, servers) {
    if (error) {
      console.log(error);
      res.send(500);
      return;
    } else if (!servers || !servers.length) {
      res.send('No Servers Found', 404);
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


exports.display = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Organization.findById(req.params.organizationId);
  query.populate('country');
  query.exec(function(error, organization) {
    if (error || !organization) {
      res.send(404);
      return;
    } else if (!organization.country || !organization.country._id) {
      res.send('Country Not Found', 404);
      return;
    }

    Server.populate(organization, {
      path: 'country.server',
    }, function(error, organization) {
      if (error) {
        console.log(error);
        res.send(500);
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
};


exports.edit = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Organization.findById(req.params.organizationId);
  query.exec(function(error, organization) {
    if (error || !organization) {
      res.send(404);
      return;
    }

    res.render('organization-edit', {
      title: 'Edit Organization',
      organization: organization,
    });
  });
};
