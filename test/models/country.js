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


import mongoose from 'mongoose';
import mockgoose from 'mockgoose';

import Country from '../../models/country';
import Server from '../../models/server';
import User from '../../models/user';


describe('Country model', () => {
  before(async () => {
    mongoose.Promise = global.Promise;
    await mockgoose(mongoose);
    await mongoose.connect('mongodb://localhost/TestingDB', {
      useMongoClient: true,
    });
  });

  after(() => mongoose.connection.close());

  afterEach((done) => mockgoose.reset(done));

  let testServer;

  before(async () => {
    testServer = await Server.create({
      name: 'test',
      shortname: 't',
    });
  });

  describe('#create', () => {
    it('should fail if the server is undefined', async () => {
      await Country.create({
        name: 'Philippines',
        shortname: 'ph',
      }).should.be.rejectedWith({
        errors: {
          server: {
            name: 'ValidatorError',
            message: 'Path `server` is required.',
          },
        },
      });
    });

    it('should fail if the name is empty', async () => {
      await Country.create({
        server: testServer,
        name: '',
        shortname: 'ph',
      }).should.be.rejectedWith({
        errors: {
          name: {
            name: 'ValidatorError',
            message: 'Path `name` is required.',
          },
        },
      });
    });

    it('should work if name exists in another server', async () => {
      const server = await Server.create({
        name: 'test2',
        shortname: 'u',
      });

      await Country.create({
        server: server,
        name: 'Philippines',
        shortname: 'ph',
      });

      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'my',
      }).should.finally.be.an.Object();
    });

    it('should fail if name exists in the server', async () => {
      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      });

      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'my',
      }).should.be.rejectedWith({
        errors: {
          name: {
            name: 'ValidatorError',
            message: 'Country name with the same server already exists',
          },
        },
      });
    });

    it('should fail if the shortname is empty', async () => {
      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: '',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Path `shortname` is required.',
          },
        },
      });
    });

    it('should fail if the shortname is too long', async () => {
      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'php',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Short name should be two letters',
          },
        },
      });
    });

    it('should fail if the shortname is too short', async () => {
      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'p',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Short name should be two letters',
          },
        },
      });
    });

    it('should work if shortname exists in another server', async () => {
      const server = await Server.create({
        name: 'test2',
        shortname: 'u',
      });

      await Country.create({
        server: server,
        name: 'Philippines',
        shortname: 'ph',
      });

      await Country.create({
        server: testServer,
        name: 'Pilipinas',
        shortname: 'ph',
      }).should.finally.be.an.Object();
    });

    it('should fail if shortname exists in the server', async () => {
      await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      });

      await Country.create({
        server: testServer,
        name: 'Pilipinas',
        shortname: 'ph',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Country short name with the same server already exists',
          },
        },
      });
    });
  });

  describe('#getUserAccessLevel', () => {
    let testCountry;
    let testUser1;
    let testUser2;
    const testAccessLevel = 7;

    before(async () => {
      testCountry = await Country.create({
        server: testServer,
        name: 'Philippines',
        shortname: 'ph',
      });

      testUser1 = await User.create({
        username: 'test1',
        password: 'secret',
        email: 'test1@example.com',
      });
      testCountry.accessList.push({
        account: testUser1._id,
        accessLevel: testAccessLevel,
      });

      testUser2 = await User.create({
        username: 'test2',
        password: 'secret',
        email: 'test2@example.com',
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
