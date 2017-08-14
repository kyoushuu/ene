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
const nock = require('nock');

const Server = require('../../models/server');

describe('Server model', () => {
  before(async () => {
    mongoose.Promise = global.Promise;
    await mockgoose(mongoose);
    return mongoose.connect('mongodb://localhost/TestingDB', {
      useMongoClient: true,
    });
  });

  after(() => mongoose.connection.close());

  afterEach(() => mockgoose.reset());

  describe('create', () => {
    it('should fail if the name is empty', () => {
      return Server.create({
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

      return Server.create({
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

    it('should fail if the shortname is empty', () => {
      return Server.create({
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

    it('should fail if the shortname is too long', () => {
      return Server.create({
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

      return Server.create({
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

  describe('getCountryInfoByName', () => {
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

    it('should fail if the country does not exists', (done) => {
      testServer.getCountryInfoByName('Mali', (error, country) => {
        should.exist(
            error,
            'No error even though country does not exists');
        error.toString().should.be.equal(
            'Country not found',
            'No error even though country does not exists');
        should.not.exist(
            country,
            'Country data returned even though country does not exists');
        done();
      });
    });

    it('should work if the country exists', (done) => {
      testServer.getCountryInfoByName('Philippines', (error, country) => {
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
        done(error);
      });
    });
  });

  describe('getRegionInfo', () => {
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

    it('should fail if the region does not exists', (done) => {
      testServer.getRegionInfo(1000, (error, region) => {
        should.exist(
            error,
            'No error even though region does not exists');
        error.toString().should.be.equal(
            'Region not found',
            'No error even though region does not exists');
        should.not.exist(
            region,
            'Region data returned even though region does not exists');
        done();
      });
    });

    it('should work if the region exists', (done) => {
      testServer.getRegionInfo(320, (error, region) => {
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
        done(error);
      });
    });
  });

  describe('getRegionStatus', () => {
    let testServer;

    before((done) => {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, (error, server) => {
        testServer = server;
        done(error);
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

    it('should fail if the region does not exists', (done) => {
      testServer.getRegionStatus(1000, (error, region) => {
        should.exist(
            error,
            'No error even though region does not exists');
        error.toString().should.be.equal(
            'Region not found',
            'No error even though region does not exists');
        should.not.exist(
            region,
            'Region data returned even though region does not exists');
        done();
      });
    });

    it('should work if the region exists', (done) => {
      testServer.getRegionStatus(320, (error, region) => {
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
        done(error);
      });
    });
  });

  describe('getAttackerBonusRegion', () => {
    let testServer;

    before((done) => {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, (error, server) => {
        testServer = server;
        done(error);
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

    it('should fail if the region does not exists', (done) => {
      testServer.getAttackerBonusRegion(1000, [
        'Philippines',
      ], (error, region) => {
        should.exist(
            error,
            'No error even though region does not exists');
        error.toString().should.be.equal(
            'Failed to lookup region information: Region not found',
            'No error even though region does not exists');
        should.not.exist(
            region,
            'Region data returned even though region does not exists');
        done();
      });
    });

    it('should fail if no neighbour region occuppied by ally', (done) => {
      testServer.getAttackerBonusRegion(121, [
        'Philippines',
      ], (error, region) => {
        should.not.exist(
            region,
            'Region data returned even though region does not exists');
        done(error);
      });
    });

    it('should pick first neighbour region occupied', (done) => {
      testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China',
      ], (error, region) => {
        region.should.be.equal(
            'Gotaland, China',
            'Region does not match');
        done(error);
      });
    });

    it('should prefer a region with on-going battle', (done) => {
      testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China', 'Finland',
      ], (error, region) => {
        region.should.be.equal(
            'Aland, Finland',
            'Region does not match');
        done(error);
      });
    });
  });
});
