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


/**
 * Module dependencies.
 */

var express = require('express');
var MongoStore = require('connect-mongo')(express);
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');

var db = require('./models/db');
var User = require('./models/user');

var routes = require('./routes');
var user = require('./routes/user');
var server = require('./routes/server');
var country = require('./routes/country');
var organization = require('./routes/organization');
var channel = require('./routes/channel');

var http = require('http');
var path = require('path');

var secret = process.env.OPENSHIFT_SECRET_TOKEN || 'your secret here';


passport.use(new LocalStrategy(function(username, password, done) {
  User.findOne({username: username}, function(error, user) {
    if (error) {
      return done(error);
    }

    if (!user || !user.isValidPassword(password)) {
      return done(null, false, {
        message: 'Incorrect username or password.',
      });
    }

    return done(null, user);
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


var app = express();

// all environments
app.set('port',
        process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 3000);
app.set('ipaddress',
        process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser(secret));
app.use(express.session({
  store: new MongoStore({
    url: db.url + db.name,
  }),
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
app.use(require('less-middleware')({src: path.join(__dirname, 'public')}));
app.use(express.static(path.join(__dirname, 'public')));

// Handle 404
app.use(function(req, res) {
  res.send(404);
});

// Handle 500
app.use(function(error, req, res, next) {
  console.log(error);
  res.send(500);
});

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

app.get('/user/new', user.create);
app.post('/user/new', user.doCreate);
app.get('/user/confirm', user.confirm);
app.post('/user/confirm', user.doConfirm);
app.get('/user/confirm/:confirmCode', user.confirmCode);
app.get('/user/recover', user.recover);
app.post('/user/recover', user.doRecover);
app.get('/user/recover/:recoverCode', user.recoverCode);
app.post('/user/recover/:recoverCode', user.doRecoverCode);
app.get('/user/signin', user.signIn);
app.post('/user/signin', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/user/signin',
  failureFlash: true,
}));
app.get('/user/signout', user.signOut);

app.get('/server/new', server.create);
app.post('/server/new', server.doCreate);
app.get('/server/:serverId', server.display);
app.get('/server/edit/:serverId', server.edit);
app.post('/server/edit/:serverId', server.doEdit);

app.get('/country/new', country.create);
app.post('/country/new', country.doCreate);
app.get('/country/:countryId', country.display);
app.get('/country/:countryId/access/new', country.addAccess);
app.post('/country/:countryId/access/new', country.doAddAccess);
app.get('/country/:countryId/channel/new', country.addChannel);
app.post('/country/:countryId/channel/new', country.doAddChannel);

app.get('/organization/new', organization.create);
app.post('/organization/new', organization.doCreate);
app.get('/organization/:organizationId', organization.display);

app.get('/channel/new', channel.create);
app.post('/channel/new', channel.doCreate);
app.get('/channel/:channelId', channel.display);

http.createServer(app).listen(
    app.get('port'), app.get('ipaddress'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
