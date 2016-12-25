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

describe('Server model', function() {
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

  describe('create', function() {
    it('should fail if the name is empty', function(done) {
      Server.create({
        name: '',
        shortname: 'p',
      }, function(error, server) {
        should.exist(
            error,
            'No error even though name is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `name` is required.',
            'New server with empty name created');
        should.not.exist(
            server,
            'Server was created even though there is an error');
        done();
      });
    });

    it('should fail if the name already exists', function(done) {
      Server.create({
        name: 'test',
        shortname: 'a',
      }, function(error, server) {
        Server.create({
          name: 'test',
          shortname: 'b',
        }, function(error, server) {
          should.exist(
              error,
              'No error even though name already exists');
          error.toString().should.be.equal(
              'ValidationError: Server name already exists',
              'New server with same name created');
          should.not.exist(
              server,
              'Server was created even though there is an error');
          done();
        });
      });
    });

    it('should fail if the shortname is empty', function(done) {
      Server.create({
        name: 'test',
        shortname: '',
      }, function(error, server) {
        should.exist(
            error,
            'No error even though shortname is empty');
        error.toString().should.be.equal(
            'ValidationError: Path `shortname` is required.',
            'New server with empty shortname created');
        should.not.exist(
            server,
            'Server was created even though there is an error');
        done();
      });
    });

    it('should fail if the shortname is too long', function(done) {
      Server.create({
        name: 'test',
        shortname: 'ab',
      }, function(error, server) {
        should.exist(
            error,
            'No error even though shortname is too long');
        error.toString().should.be.equal(
            'ValidationError: Short name should be a single letter',
            'New server with empty shortname created');
        should.not.exist(
            server,
            'Server was created even though there is an error');
        done();
      });
    });

    it('should fail if the shortname already exists', function(done) {
      Server.create({
        name: 'test',
        shortname: 'a',
      }, function(error, server) {
        Server.create({
          name: 'test2',
          shortname: 'a',
        }, function(error, server) {
          should.exist(
              error,
              'No error even though shortname already exists');
          error.toString().should.be.equal(
              'ValidationError: Server short name already exists',
              'New server with same shortname created');
          should.not.exist(
              server,
              'Server was created even though there is an error');
          done();
        });
      });
    });
  });

  describe('getCountryInfoByName', function() {
    let testServer;

    before(function(done) {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, function(error, server) {
        testServer = server;
        done(error);
      });
    });

    beforeEach(function() {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiCountries.html'
      ).replyWithFile(
          200,
          __dirname + '/data/apiCountries.html'
      );
    });

    it('should fail if the country does not exists', function(done) {
      testServer.getCountryInfoByName('Mali', function(error, country) {
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

    it('should work if the country exists', function(done) {
      testServer.getCountryInfoByName('Philippines', function(error, country) {
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

  describe('getRegionInfo', function() {
    let testServer;

    before(function(done) {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, function(error, server) {
        testServer = server;
        done(error);
      });
    });

    beforeEach(function() {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiRegions.html'
      ).replyWithFile(
          200,
          __dirname + '/data/apiRegions.html'
      );
    });

    it('should fail if the region does not exists', function(done) {
      testServer.getRegionInfo(1000, function(error, region) {
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

    it('should work if the region exists', function(done) {
      testServer.getRegionInfo(320, function(error, region) {
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

  describe('getRegionStatus', function() {
    let testServer;

    before(function(done) {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, function(error, server) {
        testServer = server;
        done(error);
      });
    });

    beforeEach(function() {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiMap.html'
      ).replyWithFile(
          200,
          __dirname + '/data/apiMap.html'
      );
    });

    it('should fail if the region does not exists', function(done) {
      testServer.getRegionStatus(1000, function(error, region) {
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

    it('should work if the region exists', function(done) {
      testServer.getRegionStatus(320, function(error, region) {
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

  describe('getAttackerBonusRegion', function() {
    let testServer;

    before(function(done) {
      Server.create({
        name: 'primera',
        shortname: 'p',
      }, function(error, server) {
        testServer = server;
        done(error);
      });
    });

    beforeEach(function() {
      nock(
          'http://primera.e-sim.org'
      ).get(
          '/apiCountries.html'
      ).replyWithFile(
          200,
          __dirname + '/data/apiCountries.html'
      ).get(
          '/apiRegions.html'
      ).replyWithFile(
          200,
          __dirname + '/data/apiRegions.html'
      ).get(
          '/apiMap.html'
      ).times(
          3
      ).replyWithFile(
          200,
          __dirname + '/data/apiMap.html'
      );
    });

    it('should fail if the region does not exists', function(done) {
      testServer.getAttackerBonusRegion(1000, [
        'Philippines',
      ], function(error, region) {
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

    it('should fail if no neighbour region occuppied by ally', function(done) {
      testServer.getAttackerBonusRegion(121, [
        'Philippines',
      ], function(error, region) {
        should.not.exist(
            region,
            'Region data returned even though region does not exists');
        done(error);
      });
    });

    it('should pick first neighbour region occupied', function(done) {
      testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China',
      ], function(error, region) {
        region.should.be.equal(
            'Gotaland, China',
            'Region does not match');
        done(error);
      });
    });

    it('should prefer a region with on-going battle', function(done) {
      testServer.getAttackerBonusRegion(121, [
        'Philippines', 'China', 'Finland',
      ], function(error, region) {
        region.should.be.equal(
            'Aland, Finland',
            'Region does not match');
        done(error);
      });
    });
  });
});
