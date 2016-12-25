/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2016  Arnel A. Borja <kyoushuu@yahoo.com>
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

const Country = require('../../models/country');
const Server = require('../../models/server');
const User = require('../../models/user');

describe('Country model', function() {
  before(function(done) {
    mongoose.Promise = global.Promise;
    mockgoose(mongoose).then(function() {
      mongoose.connect('mongodb://localhost/TestingDB', function(err) {
        done(err);
      });
    });
  });

  after(function(done) {
    mongoose.connection.close(function(err) {
      done(err);
    });
  });

  afterEach(function() {
    mockgoose.reset();
  });

  let testServer;

  before(function(done) {
    Server.create({
      name: 'test',
      shortname: 't',
    }, function(error, server) {
      should.exist(
          server,
          'Test server does not exist');
      testServer = server;

      done(error);
    });
  });

  describe('create', function() {
    it('should fail if the server is undefined', function(done) {
      Country.create({
        name: 'Philippines',
        shortname: 'ph',
      }, function(error, country) {
        should.exist(
            error,
            'No error even though server is undefined');
        error.toString().should.be.equal(
            'ValidationError: Path `server` is required.',
            'New country with undefined server created');
        should.not.exist(
            country,
            'Country was created even though there is an error');

        done();
      });
    });

    it('should fail if the name is empty', function(done) {
      Country.create({
        server: testServer,
        name: '',
        shortname: 'ph',
      }, function(error, country) {
        should.exist(
            error,
            'No error even though name is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `name` is required.',
            'New country with empty name created');
        should.not.exist(
            country,
            'Country was created even though there is an error');

        done();
      });
    });

    it('should work if name exists in another server', function(done) {
      Server.create({
        name: 'test2',
        shortname: 'u',
      }, function(error, server) {
        should.exist(
            server,
            'Test server does not exist');

        if (error) {
          done(error);
          return;
        }

        Country.create({
          server: server,
          name: 'Philippines',
          shortname: 'ph',
        }, function(error, country) {
          should.exist(
              country,
              'Test country does not exist');

          if (error) {
            done(error);
            return;
          }

          Country.create({
            server: testServer,
            name: 'Philippines',
            shortname: 'my',
          }, function(error, country) {
            should.exist(
                country,
                'Country was not created even though there is no error');

            done(error);
          });
        });
      });
    });

    it('should fail if name exists in the server', function(done) {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, function(error, country) {
        should.exist(
            country,
            'Test country does not exist');

        if (error) {
          done(error);
          return;
        }

        Country.create({
          server: testServer,
          name: 'Philippines',
          shortname: 'my',
        }, function(error, country) {
          should.exist(
              error,
              'No error even though name already exists');
          error.toString().should.be.equal(
              'ValidationError: Country name with the same server already exists',
              'New country with same name created');
          should.not.exist(
              country,
              'Country was created even though there is an error');

          done();
        });
      });
    });

    it('should fail if the shortname is empty', function(done) {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: '',
      }, function(error, country) {
        should.exist(
            error,
            'No error even though shortname is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `shortname` is required.',
            'New country with empty shortname created');
        should.not.exist(
            country,
            'Country was created even though there is an error');

        done();
      });
    });

    it('should fail if the shortname is too long', function(done) {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'php',
      }, function(error, country) {
        should.exist(
            error,
            'No error even though shortname is too long');
        error.toString().should.be.equal(
            'ValidationError: Short name should be two letters',
            'New country with empty shortname created');
        should.not.exist(
            country,
            'Country was created even though there is an error');

        done();
      });
    });

    it('should work if shortname exists in another server', function(done) {
      Server.create({
        name: 'test2',
        shortname: 'u',
      }, function(error, server) {
        should.exist(
            server,
            'Test server does not exist');

        if (error) {
          done(error);
          return;
        }

        Country.create({
          server: server,
          name: 'Philippines',
          shortname: 'ph',
        }, function(error, country) {
          should.exist(
              country,
              'Test country does not exist');

          if (error) {
            done(error);
            return;
          }

          Country.create({
            server: testServer,
            name: 'Pilipinas',
            shortname: 'ph',
          }, function(error, country) {
            should.exist(
                country,
                'Country was not created even though there is no error');

            done(error);
          });
        });
      });
    });

    it('should fail if shortname exists in the server', function(done) {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, function(error, country) {
        should.exist(
            country,
            'Test country does not exist');

        if (error) {
          done(error);
          return;
        }

        Country.create({
          server: testServer,
          name: 'Pilipinas',
          shortname: 'ph',
        }, function(error, country) {
          should.exist(
              error,
              'No error even though shortname already exists');
          error.toString().should.be.equal(
              'ValidationError: Country short name ' +
            'with the same server already exists',
              'New country with same shortname created');
          should.not.exist(
              country,
              'Country was created even though there is an error');

          done();
        });
      });
    });
  });

  describe('getUserAccessLevel', function() {
    let testCountry;
    let testUser1;
    let testUser2;
    const testAccessLevel = 7;

    before(function(done) {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, function(error, country) {
        should.exist(
            country,
            'Test country does not exist');
        testCountry = country;

        if (error) {
          done(error);
          return;
        }

        User.create({
          username: 'test1',
          password: 'secret',
          email: 'test1@example.com',
        }, function(error, user) {
          should.exist(
              user,
              'First test user does not exist');

          if (error) {
            done(error);
            return;
          }

          testUser1 = user;
          testCountry.accessList.push({
            account: testUser1._id,
            accessLevel: testAccessLevel,
          });

          User.create({
            username: 'test2',
            password: 'secret',
            email: 'test2@example.com',
          }, function(error, user) {
            should.exist(
                user,
                'Second test user does not exist');

            testUser2 = user;

            done(error);
          });
        });
      });
    });

    it('should return zero if user is not in the access list', function() {
      const accessLevel = testCountry.getUserAccessLevel(testUser2);
      accessLevel.should.be.equal(
          0,
          'Access level is not zero');
    });

    it('should return access level if user is in the access list', function() {
      const accessLevel = testCountry.getUserAccessLevel(testUser1);
      accessLevel.should.be.equal(
          testAccessLevel,
          'Access level does not match');
    });
  });
});
