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


var Channel = require('../models/channel');


exports.create = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6) {
    res.send(403);
    return;
  }

  res.render('channel-create', {
    title: 'Create Channel',
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

  Channel.create({
    name: req.body.name,
    keyword: req.body.keyword,
  }, function(error, channel) {
    if (error) {
      res.render('channel-create', {
        title: 'Create Channel',
        error: error,
        name: req.body.name,
      });
      return;
    }

    req.flash('info', 'Channel successfully created');
    res.redirect('/channel/' + channel.id);
  });
};