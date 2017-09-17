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


import should from 'should';
import mongoose from 'mongoose';
import mockgoose from 'mockgoose';
import nock from 'nock';

import Server from '../../models/server';


describe('Server model', () => {
  before(async () => {
    mongoose.Promise = global.Promise;
    await mockgoose(mongoose);
    await mongoose.connect('mongodb://localhost/TestingDB', {
      useMongoClient: true,
    });
  });

  after(() => mongoose.connection.close());

  afterEach((done) => mockgoose.reset(done));

  describe('#create', () => {
    it('should fail if the name is empty', async () => {
      await Server.create({
        name: '',
        shortname: 'p',
      }).should.be.rejectedWith({
        errors: {
          name: {
            name: 'ValidatorError',
            message: 'Path `name` is required.',
          },
        },
      });
    });

    it('should fail if the name already exists', async () => {
      await Server.create({
        name: 'test',
        shortname: 'a',
      });

      await Server.create({
        name: 'test',
        shortname: 'b',
      }).should.be.rejectedWith({
        errors: {
          name: {
            name: 'ValidatorError',
            message: 'Server name already exists',
          },
        },
      });
    });

    it('should fail if the shortname is empty', async () => {
      await Server.create({
        name: 'test',
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
      await Server.create({
        name: 'test',
        shortname: 'ab',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Short name should be a single letter',
          },
        },
      });
    });

    it('should fail if the shortname already exists', async () => {
      await Server.create({
        name: 'test',
        shortname: 'a',
      });

      await Server.create({
        name: 'test2',
        shortname: 'a',
      }).should.be.rejectedWith({
        errors: {
          shortname: {
            name: 'ValidatorError',
            message: 'Server short name already exists',
          },
        },
      });
    });
  });

  describe('#getCountryInfoByName', () => {
    let testServer;

    before(async () => {
      testServer = await Server.create({
        name: 'primera',
        shortname: 'p',
      });
    });

    beforeEach(() => {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiCountries.html'
      ).replyWithFile(
          200,
          `${__dirname}/data/apiCountries.html`
      );
    });

    it('should fail if the country does not exists', async () => {
      await testServer.getCountryInfoByName('Mali')
          .should.be.rejectedWith('Country not found');
    });

    it('should work if the country exists', async () => {
      const country = await testServer.getCountryInfoByName('Philippines');
      country.capitalName.should.be.equal(
          'Manila',
          'Country capitalName does not match');
      country.currencyName.should.be.equal(
          'PHP',
          'Country currencyName does not match');
      country.name.should.be.equal(
          'Philippines',
          'Country name does not match');
      country.id.should.be.equal(
          54,
          'Country id does not match');
      country.shortName.should.be.equal(
          'PH',
          'Country shortName does not match');
      country.capitalRegionId.should.be.equal(
          320,
          'Country capitalRegionId does not match');
    });
  });

  describe('#getRegionInfo', () => {
    let testServer;

    before(async () => {
      testServer = await Server.create({
        name: 'primera',
        shortname: 'p',
      });
    });

    beforeEach(() => {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiRegions.html'
      ).replyWithFile(
          200,
          `${__dirname}/data/apiRegions.html`
      );
    });

    it('should fail if the region does not exists', async () => {
      await testServer.getRegionInfo(1000)
          .should.be.rejectedWith('Region not found');
    });

    it('should work if the region exists', async () => {
      const region = await testServer.getRegionInfo(320);
      region.capital.should.be.equal(
          true,
          'Region capital does not match');
      region.name.should.be.equal(
          'Manila',
          'Region name does not match');
      region.neighbours.toString().should.be.equal(
          '319,323,324',
          'Region neighbours does not match');
      region.id.should.be.equal(
          320,
          'Region id does not match');
      region.homeCountry.should.be.equal(
          54,
          'Region homeCountry does not match');
      region.rawRichness.should.be.equal(
          'NONE',
          'Region rawRichness does not match');
    });
  });

  describe('#getRegionStatus', () => {
    let testServer;

    before(async () => {
      testServer = await Server.create({
        name: 'primera',
        shortname: 'p',
      });
    });

    beforeEach(() => {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiMap.html'
      ).replyWithFile(
          200,
          `${__dirname}/data/apiMap.html`
      );
    });

    it('should fail if the region does not exists', async () => {
      await testServer.getRegionStatus(1000)
          .should.be.rejectedWith('Region not found');
    });

    it('should work if the region exists', async () => {
      const region = await testServer.getRegionStatus(320);
      region.battle.should.be.equal(
          false,
          'Region battle does not match');
      region.capital.should.be.equal(
          true,
          'Region capital does not match');
      region.companies.should.be.equal(
          126,
          'Region companies does not match');
      region.regionId.should.be.equal(
          320,
          'Region regionId does not match');
      region.defensiveBuildings.should.be.equal(
          7,
          'Region defensiveBuildings does not match');
      region.openWaterAccess.should.be.equal(
          true,
          'Region openWaterAccess does not match');
      region.occupantId.should.be.equal(
          54,
          'Region occupantId does not match');
      region.rawRichness.should.be.equal(
          'NONE',
          'Region rawRichness does not match');
      region.population.should.be.equal(
          45,
          'Region population does not match');
    });
  });

  describe('#getAttackerBonusRegion', () => {
    let testServer;

    before(async () => {
      testServer = await Server.create({
        name: 'primera',
        shortname: 'p',
      });
    });

    beforeEach(() => {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiCountries.html'
      ).replyWithFile(
          200,
          `${__dirname}/data/apiCountries.html`
      ).get(
          '/apiRegions.html'
      ).replyWithFile(
          200,
          `${__dirname}/data/apiRegions.html`
      ).get(
          '/apiMap.html'
      ).times(
          3
      ).replyWithFile(
          200,
          `${__dirname}/data/apiMap.html`
      );
    });

    it('should fail if the region does not exists', async () => {
      await testServer.getAttackerBonusRegion(1000, [
        'Philippines',
      ]).should.be.rejectedWith('Region not found');
    });

    it('should fail if no neighbour region occuppied by ally', async () => {
      const region = await testServer.getAttackerBonusRegion(121, [
        'Philippines',
      ]);

      should.not.exist(
          region,
          'Region data returned even though region does not exists');
    });

    it('should pick first neighbour region occupied', async () => {
      const region = await testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China',
      ]);

      region.should.be.equal(
          'Gotaland, China',
          'Region does not match');
    });

    it('should prefer a region with on-going battle', async () => {
      const region = await testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China', 'Finland',
      ]);

      region.should.be.equal(
          'Aland, Finland',
          'Region does not match');
    });
  });
});
