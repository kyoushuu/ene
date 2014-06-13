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
var db = require('./models/db');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var secret = process.env.OPENSHIFT_SECRET_TOKEN || 'your secret here';

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('ipadress', process.env.IP || '127.0.0.1');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser(secret));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({src: path.join(__dirname, 'public')}));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

app.get('/user/new', user.create);
app.post('/user/new', user.doCreate);
app.get('/user/confirm/:confirmCode', user.confirm);

http.createServer(app).listen(
    app.get('port'), app.get('ipaddress'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
