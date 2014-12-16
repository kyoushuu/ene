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
var nodemailer = require('nodemailer');
var passport = require('passport');

var User = require('../models/user');
var Server = require('../models/server');


function sendEmail(user, subject, body, callback) {
  var domain = process.env.DOMAIN ||
      process.env.OPENSHIFT_APP_DNS || 'localhost';
  var sender = process.env.SMTP_SENDER || 'no-reply@' + domain;
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
    from: 'Ene Project <' + sender + '>',
    to: user.username + ' <' + user.email + '>',
    subject: subject,
    text: body,
  }, function(error, response) {
    callback(error, response);
    transport.close();
  });
}


router.route('/new').get(function(req, res) {
  res.render('signup', {title: 'Sign Up'});
}).post(function(req, res) {
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
});

function sendConfirmEmail(user, callback) {
  var address = process.env.ADDRESS || process.env.DOMAIN ||
      process.env.OPENSHIFT_APP_DNS || 'localhost:3000';

  sendEmail(user, 'New account confirmation',
            'Welcome ' + user.username + ',\n\n' +
            'You can confirm your account through this link:\n' +
            'http://' + address + '/user/confirm/' + user.confirmCode,
            function(error, response) {
              if (!error) {
                callback(null);
              } else {
                callback(error);
              }
            });
}


router.route('/confirm').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  res.render('confirm', {
    title: 'Confirm your account',
    user: req.user,
  });
}).post(function(req, res) {
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
});


router.get('/confirm/:confirmCode', function(req, res) {
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
});

function confirmFailed(res) {
  res.render('confirm', {
    title: 'Account confirmation failed',
  });
}


router.route('/recover').get(function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  res.render('recover', {
    title: 'Recover your account',
  });
}).post(function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  User.findOne({
    email: req.body.email.toLowerCase(),
  }, function(error, user) {
    if (error) {
      res.sendStatus(500);
      return;
    } else if (!user) {
      doRecoverFailed(res, user, req.body.email, 'Email not registered');
      return;
    }

    user.recover(function(error) {
      if (error) {
        doRecoverFailed(res, user, req.body.email, error);
        return;
      }

      sendRecoverEmail(user, function(error) {
        if (error) {
          console.log('Failed to send recovery email: ' + error);
        }

        res.render('recover', {
          title: 'Email Sent',
          sent: true,
        });
      });
    });
  });
});

function doRecoverFailed(res, user, email, error) {
  res.render('recover', {
    title: 'Recover your account',
    user: user,
    email: email,
  });
}

function sendRecoverEmail(user, callback) {
  var address = process.env.ADDRESS || process.env.DOMAIN ||
      process.env.OPENSHIFT_APP_DNS || 'localhost:3000';

  sendEmail(user, 'Account Recovery',
            'Hello ' + user.username + ',\n\n' +
            'You can recover your account through this link:\n' +
            'http://' + address + '/user/recover/' + user.recoverCode,
            function(error, response) {
              if (!error) {
                callback(null);
              } else {
                callback(error);
              }
            });
}


router.route('/recover/:recoverCode').get(function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  User.findOne({
    recoverCode: req.params.recoverCode,
  }, function(error, user) {
    if (error) {
      res.sendStatus(500);
      return;
    } else if (!user) {
      doRecoverFailed(res, null, 'Invalid code');
      return;
    }

    res.render('recover-code', {
      title: 'Create new password',
    });
  });
}).post(function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }

  User.findOne({
    recoverCode: req.params.recoverCode,
  }, function(error, user) {
    if (error) {
      res.sendStatus(500);
      return;
    } else if (!user) {
      doRecoverCodeFailed(res, null, 'Invalid code');
      return;
    }

    user.recoverCode = null;
    user.password = req.body.password;
    user.save(function(error) {
      if (error) {
        doRecoverCodeFailed(res, user, error);
        return;
      }

      req.logIn(user, function(error) {
        res.redirect('/');
      });
    });
  });
});

function doRecoverCodeFailed(res, user, error) {
  res.render('recover-code', {
    title: 'Account recovery failed',
    user: user,
    error: error,
  });
}


router.route('/:userId/citizen/new').get(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6 && req.user.id !== req.params.userId) {
    res.sendStatus(403);
    return;
  }

  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('user-add-citizen', {
      title: 'New User Citizen',
      servers: servers,
    });
  });
}).post(function(req, res) {
  if (!req.isAuthenticated()) {
    res.redirect('/user/signin');
    return;
  }

  if (req.user.accessLevel < 6 && req.user.id !== req.params.userId) {
    res.sendStatus(403);
    return;
  }

  Server.findById(req.body.server, function(error, server) {
    if (error || !server) {
      res.status(404).send('Server Not Found');
      return;
    }

    var l = req.user.citizens.length;
    for (var i = 0; i < l; i++) {
      if (req.user.citizens[i].name === req.body.name &&
          req.user.citizens[i].server.equals(server._id)) {
        doAddCitizenFailed(req, res, 'Citizen already exists');
        return;
      }
    }

    req.user.citizens.push({
      server: server._id,
      name: req.body.name,
    });

    req.user.save(function(error) {
      if (error) {
        doAddCitizenFailed(req, res, error);
        return;
      }

      req.flash('info', 'Citizen successfully added');
      res.redirect('/user/' + req.user.id);
    });
  });
});

function doAddCitizenFailed(req, res, err) {
  Server.find({}, null, {sort: {_id: 1}}, function(error, servers) {
    if (error) {
      console.log(error);
      res.sendStatus(500);
      return;
    } else if (!servers || !servers.length) {
      res.status(404).send('No Servers Found');
      return;
    }

    res.render('user-add-citizen', {
      title: 'New User Citizen',
      error: err,
      servers: servers,
      server: req.body.server,
      name: req.body.name,
    });
  });
}


router.route('/signin').get(function(req, res) {
  res.render('signin', {
    title: 'Sign In',
    error: req.flash('error'),
  });
}).post(passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/user/signin',
  failureFlash: true,
}));


router.get('/signout', function(req, res) {
  req.logOut();
  res.redirect('/');
});


module.exports = router;
