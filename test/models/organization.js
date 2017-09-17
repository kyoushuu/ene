/*
 * ene - IRC bot for e-Sim
 * Copyright (C) 2017  Arnel A. Borja <kyoushuu@yahoo.com>
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

import Organization from '../../models/organization';
import Country from '../../models/country';
import Server from '../../models/server';


describe('Organization model', () => {
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
  let testCountry;

  before(async () => {
    testServer = await Server.create({
      name: 'test',
      shortname: 't',
    });
    testCountry = await Country.create({
      server: testServer,
      name: 'Philippines',
      shortname: 'ph',
    });
  });

  describe('#create', () => {
    it('should fail if the country is undefined', async () => {
      await Organization.create({
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      }).should.be.rejectedWith({
        errors: {
          country: {
            name: 'ValidatorError',
            message: 'Path `country` is required.',
          },
        },
      });
    });

    it('should fail if the username is empty', async () => {
      await Organization.create({
        country: testCountry,
        username: '',
        password: 'testpass',
        shortname: 'afp',
      }).should.be.rejectedWith({
        errors: {
          username: {
            name: 'ValidatorError',
            message: 'Path `username` is required.',
          },
        },
      });
    });

    it('should fail if the password is empty', async () => {
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: '',
        shortname: 'afp',
      }).should.be.rejectedWith({
        errors: {
          password: {
            name: 'ValidatorError',
            message: 'Path `password` is required.',
          },
        },
      });
    });

    it('should work if username exists in another country', async () => {
      const country = await Country.create({
        server: testServer,
        name: 'Mali',
        shortname: 'ml',
      });

      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      });

      await Organization.create({
        country: country,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      }).should.finally.be.an.Object();
    });

    it('should fail if username exists in the country', async () => {
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      });

      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'slp',
      }).should.be.rejectedWith({
        errors: {
          username: {
            name: 'ValidatorError',
            message: 'Organization username with the same country already exists',
          },
        },
      });
    });

    it('should fail if the shortname is empty', async () => {
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
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
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp2',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Short username should be two or three letters',
          },
        },
      });
    });

    it('should fail if the shortname is too short', async () => {
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'a',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Short username should be two or three letters',
          },
        },
      });
    });

    it('should work if shortname exists in another country', async () => {
      const country = await Country.create({
        server: testServer,
        name: 'Mali',
        shortname: 'ml',
      });

      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      });

      await Organization.create({
        country: country,
        username: 'Sandatahang Lakas ng Pilipinas',
        password: 'testpass',
        shortname: 'afp',
      }).should.finally.be.an.Object();
    });

    it('should fail if shortname exists in the country', async () => {
      await Organization.create({
        country: testCountry,
        username: 'Armed Forces of the Philippines',
        password: 'testpass',
        shortname: 'afp',
      });

      await Organization.create({
        country: testCountry,
        username: 'Sandatahang Lakas ng Pilipinas',
        password: 'testpass',
        shortname: 'afp',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Organization short username with the same country already exists',
          },
        },
      });
    });
  });
});
