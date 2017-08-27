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
const nodemailer = require('nodemailer');
const passport = require('passport');

const {ensureSignedIn, asyncWrap} = require('./common');

const User = require('../models/user');
const Server = require('../models/server');


async function sendEmail(user, subject, body) {
  const domain = process.env.DOMAIN || 'localhost';
  const sender = process.env.SMTP_SENDER || `no-reply@${domain}`;
  const transport = nodemailer.createTransport(process.env.SMTP_URL);

  const response = await transport.sendMail({
    from: {name: 'Ene Project', address: sender},
    to: {name: user.username, address: user.email},
    subject: subject,
    text: body,
  });

  transport.close();

  return response;
}


async function sendConfirmEmail(user) {
  const address = process.env.ADDRESS || process.env.DOMAIN || 'localhost:3000';

  await sendEmail(user, 'New account confirmation',
      `Welcome ${user.username},

You can confirm your account through this link:
http://${address}/user/confirm/${user.confirmCode}`);
}

router.route('/new').get((req, res) => {
  res.render('signup', {title: 'Sign Up'});
}).post(asyncWrap(async (req, res) => {
  try {
    const user = await User.create({
      username: req.body.username,
      password: req.body.password,
      email: req.body.email,
    });

    await sendConfirmEmail(user);

    res.render('welcome', {title: 'Welcome'});
  } catch (error) {
    res.render('signup', {
      title: 'Sign Up',
      error: error,
      username: req.body.username,
      email: req.body.email,
    });
  }
}));


router.route('/confirm').get(ensureSignedIn, (req, res) => {
  res.render('confirm', {
    title: 'Confirm your account',
    user: req.user,
  });
}).post(ensureSignedIn, asyncWrap(async (req, res) => {
  await sendConfirmEmail(req.user);

  res.render('confirm', {
    title: 'Email Resent',
    user: req.user,
    resent: true,
  });
}));


router.get('/confirm/:confirmCode', asyncWrap(async (req, res) => {
  const user = await User.findOne({
    confirmCode: req.params.confirmCode,
  });

  try {
    if (!user) {
      throw new Error('User with given confirm code not found');
    }

    user.confirmCode = null;
    await user.save();

    res.render('confirm', {
      title: 'Account confirmed',
      user: user,
    });
  } catch (error) {
    res.render('confirm', {
      title: 'Account confirmation failed',
    });
  }
}));


function doRecoverFailed(res, user, email, error) {
  res.render('recover', {
    title: 'Recover your account',
    user: user,
    email: email,
  });
}

router.route('/recover').get((req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  res.render('recover', {
    title: 'Recover your account',
  });
}).post(asyncWrap(async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  const user = await User.findOne({
    email: req.body.email.toLowerCase(),
  });

  try {
    if (!user) {
      throw new Error('Email not registered');
    }

    await user.recover();

    const address = process.env.ADDRESS || process.env.DOMAIN ||
        'localhost:3000';

    await sendEmail(user, 'Account Recovery',
        `Hello ${user.username},

You can recover your account through this link:
http://${address}/user/recover/${user.recoverCode}`);

    res.render('recover', {
      title: 'Email Sent',
      sent: true,
    });
  } catch (error) {
    doRecoverFailed(res, user, req.body.email, error);
  }
}));


router.route('/recover/:recoverCode').get(asyncWrap(async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  const user = await User.findOne({
    recoverCode: req.params.recoverCode,
  });

  if (!user) {
    doRecoverFailed(res, null, 'Invalid code');
    return;
  }

  res.render('recover-code', {
    title: 'Create new password',
  });
})).post(asyncWrap(async (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  const user = await User.findOne({
    recoverCode: req.params.recoverCode,
  });

  try {
    if (!user) {
      throw new Error('Invalid code');
    }

    user.recoverCode = null;
    user.password = req.body.password;
    await user.save();

    req.logIn(user, (error) => {
      res.redirect('/');
    });
  } catch (error) {
    res.render('recover-code', {
      title: 'Account recovery failed',
      user: user,
      error: error,
    });
  }
}));


router.route('/:userId/citizen/new').get(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6 && req.user.id !== req.params.userId) {
    res.sendStatus(403);
    return;
  }

  const servers = await Server.find({}, null, {sort: {_id: 1}});
  if (!servers || !servers.length) {
    res.status(404).send('No Servers Found');
    return;
  }

  res.render('user-add-citizen', {
    title: 'New User Citizen',
    servers: servers,
  });
})).post(ensureSignedIn, asyncWrap(async (req, res) => {
  if (req.user.accessLevel < 6 && req.user.id !== req.params.userId) {
    res.sendStatus(403);
    return;
  }

  const server = await Server.findById(req.body.server);
  if (!server) {
    res.status(404).send('Server Not Found');
    return;
  }

  try {
    for (const citizen of req.user.citizens) {
      if (citizen.name === req.body.name &&
          citizen.server.equals(server._id)) {
        throw new Error('Citizen already exists');
      }
    }

    req.user.citizens.push({
      server: server._id,
      name: req.body.name,
    });

    await req.user.save();

    req.flash('info', 'Citizen successfully added');
    res.redirect(`/user/${req.user.id}`);
  } catch (error) {
    const servers = await Server.find({}, null, {sort: {_id: 1}});
    if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('user-add-citizen', {
      title: 'New User Citizen',
      error: error,
      servers: servers,
      server: req.body.server,
      name: req.body.name,
    });
  }
}));


router.route('/signin').get((req, res) => {
  res.render('signin', {
    title: 'Sign In',
    error: req.flash('error'),
  });
}).post(passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/user/signin',
  failureFlash: true,
}));


router.get('/signout', (req, res) => {
  req.logOut();
  res.redirect('/');
});


module.exports = router;
