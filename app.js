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


import express from 'express';
import path from 'path';
import favicon from 'serve-favicon';
import logger from 'morgan';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import bodyParser from 'body-parser';

import mongo from 'connect-mongo';
import passport from 'passport';
import {Strategy as LocalStrategy} from 'passport-local';
import flash from 'connect-flash';
import less from 'less-middleware';

import db from './models/db';
import User from './models/user';

import routes from './routes/index';
import user from './routes/user';
import server from './routes/server';
import country from './routes/country';
import organization from './routes/organization';
import channel from './routes/channel';
import api from './routes/api';

const secret = process.env.SECRET_KEY || 'secret';

const MongoStore = mongo(session);


passport.use(new LocalStrategy((username, password, done) => {
  User.findOne({username: username}, (error, user) => {
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

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});


const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(`${__dirname}/public/favicon.ico`));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser(secret));
app.use(session({
  secret: secret,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    url: db.url + db.name,
  }),
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(less(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/user', user);
app.use('/server', server);
app.use('/country', country);
app.use('/organization', organization);
app.use('/channel', channel);
app.use('/api', api);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {},
  });
});


export default app;
