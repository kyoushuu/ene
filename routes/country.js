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
var Country = require('../models/country');
var User = require('../models/user');
var Channel = require('../models/channel');


router.route('/new').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || servers.length < 1) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('country-create', {
      title: 'Create Country',
      servers: servers,
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

  Server.findById(req.body.server, function(error, server) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!server) {
      res.status(404).send('Server Not Found');
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

      server.countries.push(country);
      server.save(function(error) {
        if (error) {
          doCreateFailed(req, res, error);
          return;
        }

        req.flash('info', 'Country successfully created');
        res.redirect('/country/' + country.id);
      });
    });
  });
});

function doCreateFailed(req, res, err) {
  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || servers.length < 1) {
      res.status(404).send('No Servers Found');
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


router.get('/:countryId', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Country.findById(req.params.countryId).populate('server');
  query.exec(function(error, country) {
    if (error || !country) {
      res.sendStatus(404);
      return;
    }

    res.render('country', {
      title: 'Country Information',
      country: country,
      info: req.flash('info'),
    });
  });
});


router.get('/:countryId/access', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  var query = Country.findById(req.params.countryId);
  query.populate('accessList.account').exec(function(error, country) {
    if (error || !country) {
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
  });
});


router.route('/:countryId/access/new').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  Country.findById(req.params.countryId, function(error, country) {
    if (error || !country) {
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
  });
}).post(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  User.findOne({username: req.body.username}, function(error, user) {
    if (error || !user) {
      doAddAccessFailed(req, res, 'Username not found');
      return;
    }

    Country.findById(req.params.countryId, function(error, country) {
      if (error || !country) {
        res.sendStatus(404);
        return;
      }

      var access = null;
      var accessLevel = 0;
      var l = country.accessList.length;
      for (var i = 0; i < l; i++) {
        if (country.accessList[i].account.equals(req.user._id)) {
          accessLevel = country.accessList[i].accessLevel;
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

      country.save(function(error) {
        if (error) {
          doAddAccessFailed(req, res, error);
          return;
        }

        req.flash('info', 'Access successfully added');
        res.redirect('/country/' + country.id);
      });
    });
  });
});

function doAddAccessFailed(req, res, err) {
  res.render('country-access-add', {
    title: 'New Country Access',
    error: err,
    username: req.body.username,
    accessLevel: req.body.accessLevel,
  });
}


router.get('/:countryId/access/remove/:accessId', function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  Country.findById(req.params.countryId, function(error, country) {
    if (error || !country) {
      res.sendStatus(404);
      return;
    }

    var access = country.accessList.id(req.params.accessId);
    if (!access) {
      req.flash('error', 'Access not found');
      res.redirect('/country/' + country.id + '/access');
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

    country.save(function(error) {
      if (error) {
        doAddAccessFailed(req, res, error);
        return;
      }

      req.flash('info', 'Access successfully removed');
      res.redirect('/country/' + country.id + '/access');
    });
  });
});


router.route('/:countryId/channel/new').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.sendStatus(403);
    return;
  }

  Country.findById(req.params.countryId, function(error, country) {
    if (error || !country) {
      res.sendStatus(404);
      return;
    }

    res.render('country-channel-add', {
      title: 'New Country Channel',
    });
  });
}).post(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  Channel.findOne({name: req.body.name}, function(error, channel) {
    if (error || !channel) {
      doAddChannelFailed(req, res, 'Channel not found');
      return;
    }

    if (req.user.accessLevel < 6) {
      res.sendStatus(403);
      return;
    }

    Country.findById(req.params.countryId, function(error, country) {
      if (error || !country) {
        res.sendStatus(404);
        return;
      }

      var l = country.channels.length;
      for (var i = 0; i < l; i++) {
        if (country.channels[i].channel.equals(channel._id)) {
          doAddChannelFailed(req, res, 'Channel already exists');
          return;
        }
      }

      var types = [];

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

      country.save(function(error) {
        if (error) {
          doAddChannelFailed(req, res, error);
          return;
        }

        channel.countries.push(country._id);

        channel.save(function(error) {
          if (error) {
            doAddChannelFailed(req, res, error);
            return;
          }

          req.flash('info', 'Channel successfully added');
          res.redirect('/country/' + country.id);
        });
      });
    });
  });
});

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


module.exports = router;
