#!/usr/bin/env node
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


import _debug from 'debug';
const debug = _debug('ene');
import mongoose from 'mongoose';

import app from './app';
import bot from './irc-bot/bot';


mongoose.connection.on('connected', () => {
  debug('Mongoose connected');
});

mongoose.connection.on('disconnected', () => {
  debug('Mongoose disconnected');
});

mongoose.connection.on('error', (error) => {
  debug(`Mongoose connection error: ${error}`);
});


app.set('port', process.env.PORT || 3000);
app.set('ipaddress', process.env.IP || '127.0.0.1');

const server = app.listen(app.get('port'), app.get('ipaddress'), () => {
  debug(`Express server listening on port ${server.address().port}`);
});


bot.connect();


function close() {
  mongoose.connection.close(() => {
    debug('Mongoose disconnected because of app termination');
  });

  server.close(() => {
    debug('Express server disconnected because of app termination');
  });

  bot.disconnect(() => {
    debug('IRC bot disconnected because of app termination');
  });
}

process.on('SIGINT', () => {
  close();
});

process.on('SIGTERM', () => {
  close();
});
