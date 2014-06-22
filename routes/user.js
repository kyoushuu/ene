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


var User = require('../models/user');
var nodemailer = require('nodemailer');


exports.create = function(req, res) {
  res.render('signup', {title: 'Sign Up'});
};


exports.doCreate = function(req, res) {
  User.create({
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
  }, function(error, user) {
    if (!error) {
      sendConfirmEmail(user, function(error) {
        if (error) {
          console.log('Failed to send confirmation email: ' + error);
        }
        res.render('welcome', {title: 'Welcome'});
      });
    } else {
      res.render('signup', {
        title: 'Sign Up',
        error: error,
        username: req.body.username,
        email: req.body.email,
      });
    }
  });
};

function sendConfirmEmail(user, callback) {
  var domain = process.env.DOMAIN ||
      process.env.OPENSHIFT_APP_DNS || 'localhost';
  var address = process.env.ADDRESS || process.env.DOMAIN ||
      process.env.OPENSHIFT_APP_DNS || 'localhost:3000';
  var transport = nodemailer.createTransport('SMTP', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 465,
    secureConnection: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  transport.sendMail({
    from: 'Ene Project <no-reply@' + domain + '>',
    to: user.username + ' <' + user.email + '>',
    subject: 'New account confirmation',
    text: 'Welcome ' + user.username + ',\n\n' +
        'You can confirm your account through this link:\n' +
        'http://' + address + '/user/confirm/' + user.confirmCode,
  }, function(error, response) {
    if (!error) {
      callback(null);
    } else {
      callback(error);
    }
    transport.close();
  });
}


exports.confirm = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  res.render('confirm', {
    title: 'Confirm your account',
    user: req.user,
  });
};


exports.doConfirm = function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  sendConfirmEmail(req.user, function(error) {
    if (error) {
      console.log('Failed to send confirmation email: ' + error);
    }
    res.render('confirm', {
      title: 'Email Resent',
      user: req.user,
      resent: true,
    });
  });
};


exports.confirmCode = function(req, res) {
  User.findOne({
    confirmCode: req.params.confirmCode,
  }, function(error, user) {
    if (!error && user) {
      user.confirmCode = null;
      user.save(function(error) {
        if (!error) {
          res.render('confirm', {
            title: 'Account confirmed',
            user: user,
          });
        } else {
          confirmFailed(res);
        }
      });
    } else {
      confirmFailed(res);
    }
  });
};

function confirmFailed(res) {
  res.render('confirm', {
    title: 'Account confirmation failed',
  });
}


exports.signIn = function(req, res) {
  res.render('signin', {
    title: 'Sign In',
    error: req.flash('error'),
  });
};


exports.signOut = function(req, res) {
  req.logOut();
  res.redirect('/');
};
