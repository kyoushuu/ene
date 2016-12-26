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


const should = require('should');
const mongoose = require('mongoose');
const mockgoose = require('mockgoose');

const User = require('../../models/user');

describe('User model', () => {
  before((done) => {
    mongoose.Promise = global.Promise;
    mockgoose(mongoose).then(() => {
      mongoose.connect('mongodb://localhost/TestingDB', (err) => {
        done(err);
      });
    });
  });

  after((done) => {
    mongoose.connection.close((err) => {
      done(err);
    });
  });

  afterEach(() => {
    mockgoose.reset();
  });

  describe('create', () => {
    it('should create a confirm code', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        user.confirmCode.should.not.be.empty().and.have.lengthOf(
            32,
            'Confirm code is empty');
        done();
      });
    });

    it('should fail if the username is empty', (done) => {
      User.create({
        username: '',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        should.exist(
            error,
            'No error even though username is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `username` is required.',
            'New user with empty username created');
        should.not.exist(
            user,
            'User was created even though there is an error');
        done();
      });
    });

    it('should fail if the username already exists', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        User.create({
          username: 'test',
          password: 'secret',
          email: 'test2@example.com',
        }, (error, user) => {
          should.exist(
              error,
              'No error even though username already exists');
          error.toString().should.be.equal(
              'ValidationError: Username already exists',
              'New user with same username created');
          should.not.exist(
              user,
              'User was created even though there is an error');
          done();
        });
      });
    });

    it('should fail if the password is empty', (done) => {
      User.create({
        username: 'test',
        password: '',
        email: 'test@example.com',
      }, (error, user) => {
        should.exist(
            error,
            'No error even though password is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `password` is required.',
            'New user with empty password created');
        should.not.exist(
            user,
            'User was created even though there is an error');
        done();
      });
    });

    it('should fail if the e-mail is empty', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: '',
      }, (error, user) => {
        should.exist(
            error,
            'No error even though e-mail is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `email` is required.',
            'New user with empty e-mail created');
        should.not.exist(
            user,
            'User was created even though there is an error');
        done();
      });
    });

    it('should fail if the e-mail is already registered', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        User.create({
          username: 'test2',
          password: 'secret',
          email: 'test@example.com',
        }, (error, user) => {
          should.exist(
              error,
              'No error even though e-mail is already registered');
          error.toString().should.be.equal(
              'ValidationError: E-mail is already registered',
              'New user with same e-mail address created');
          should.not.exist(
              user,
              'User was created even though there is an error');
          done();
        });
      });
    });

    it('should fail if the e-mail is invalid', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example',
      }, (error, user) => {
        should.exist(
            error,
            'No error even though e-mail is invalid');
        error.toString().should.be.equal(
            'ValidationError: E-mail is invalid',
            'New user with invalid e-mail address created');
        should.not.exist(
            user,
            'User was created even though there is an error');
        done();
      });
    });

    it('should fail if the nickname is already in use', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
        nicknames: ['nick1', 'nick2'],
      }, (error, user) => {
        User.create({
          username: 'test2',
          password: 'secret',
          email: 'test2@example.com',
          nicknames: ['nick2', 'nick3'],
        }, (error, user) => {
          should.exist(
              error,
              'No error even though nickname is already in use');
          error.toString().should.be.equal(
              'ValidationError: Nickname is already in use',
              'New user with same nickname created');
          should.not.exist(
              user,
              'User was created even though there is an error');
          done();
        });
      });
    });
  });

  describe('setPassword', () => {
    it('should change the password', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        user.password = 'newsecret';

        user.isValidPassword('secret').should.be.equal(
            false,
            'Current password is the old password');
        user.isValidPassword('newsecret').should.be.equal(
            true,
            'Current password is not the new password');
        done();
      });
    });

    it('should change the salt', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        const oldSalt = user.salt;
        user.password = 'secret';

        oldSalt.should.not.be.equal(
            user.salt,
            'Password salt did not changed');
        done();
      });
    });

    it('should fail if the password is empty', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        user.password = '';
        user.save((error) => {
          User.findOne({
            username: user.username,
          }, (error, user) => {
            user.isValidPassword('secret').should.be.equal(
                true,
                'Current password is not the old password');
            done();
          });
        });
      });
    });
  });

  describe('isValidPassword', () => {
    it('should return true if the password is the same', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        user.isValidPassword('secret').should.be.equal(
            true,
            'Returned false even though password is the same');
        done();
      });
    });

    it('should return false if the password is not the same', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        user.isValidPassword('').should.be.equal(
            false,
            'Returned true even though password is not the same');
        done();
      });
    });
  });

  describe('recover', () => {
    it('should create a recovery code', (done) => {
      User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      }, (error, user) => {
        should.not.exist(user.recoverCode, 'Recover code exists');
        user.recover((error) => {
          user.recoverCode.should.not.be.empty().and.have.lengthOf(
              32,
              'Recover code is empty');
          done(error);
        });
      });
    });
  });
});
