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

describe('Country model', () => {
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

  let testServer;

  before((done) => {
    Server.create({
      name: 'test',
      shortname: 't',
    }, (error, server) => {
      should.exist(
          server,
          'Test server does not exist');
      testServer = server;

      done(error);
    });
  });

  describe('create', () => {
    it('should fail if the server is undefined', (done) => {
      Country.create({
        name: 'Philippines',
        shortname: 'ph',
      }, (error, country) => {
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

    it('should fail if the name is empty', (done) => {
      Country.create({
        server: testServer,
        name: '',
        shortname: 'ph',
      }, (error, country) => {
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

    it('should work if name exists in another server', (done) => {
      Server.create({
        name: 'test2',
        shortname: 'u',
      }, (error, server) => {
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
        }, (error, country) => {
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
          }, (error, country) => {
            should.exist(
                country,
                'Country was not created even though there is no error');

            done(error);
          });
        });
      });
    });

    it('should fail if name exists in the server', (done) => {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, (error, country) => {
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
        }, (error, country) => {
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

    it('should fail if the shortname is empty', (done) => {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: '',
      }, (error, country) => {
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

    it('should fail if the shortname is too long', (done) => {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'php',
      }, (error, country) => {
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

    it('should work if shortname exists in another server', (done) => {
      Server.create({
        name: 'test2',
        shortname: 'u',
      }, (error, server) => {
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
        }, (error, country) => {
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
          }, (error, country) => {
            should.exist(
                country,
                'Country was not created even though there is no error');

            done(error);
          });
        });
      });
    });

    it('should fail if shortname exists in the server', (done) => {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, (error, country) => {
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
        }, (error, country) => {
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

  describe('getUserAccessLevel', () => {
    let testCountry;
    let testUser1;
    let testUser2;
    const testAccessLevel = 7;

    before((done) => {
      Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      }, (error, country) => {
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
        }, (error, user) => {
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
          }, (error, user) => {
            should.exist(
                user,
                'Second test user does not exist');

            testUser2 = user;

            done(error);
          });
        });
      });
    });

    it('should return zero if user is not in the access list', () => {
      const accessLevel = testCountry.getUserAccessLevel(testUser2);
      accessLevel.should.be.equal(
          0,
          'Access level is not zero');
    });

    it('should return access level if user is in the access list', () => {
      const accessLevel = testCountry.getUserAccessLevel(testUser1);
      accessLevel.should.be.equal(
          testAccessLevel,
          'Access level does not match');
    });
  });
});
