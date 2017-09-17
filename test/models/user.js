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


import should from 'should';
import mongoose from 'mongoose';
import mockgoose from 'mockgoose';

import User from '../../models/user';


describe('User model', () => {
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
    it('should create a confirm code', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });
      user.confirmCode.should.not.be.empty().and.have.lengthOf(
          32,
          'Confirm code is empty');
    });

    it('should fail if the username is empty', async () => {
      await User.create({
        username: '',
        password: 'secret',
        email: 'test@example.com',
      }).should.be.rejectedWith({
        errors: {
          username: {
            name: 'ValidatorError',
            message: 'Path `username` is required.',
          },
        },
      });
    });

    it('should fail if the username already exists', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });

      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test2@example.com',
      }).should.be.rejectedWith({
        errors: {
          username: {
            name: 'ValidatorError',
            message: 'Username already exists',
          },
        },
      });
    });

    it('should fail if the password is empty', async () => {
      await User.create({
        username: 'test',
        password: '',
        email: 'test@example.com',
      }).should.be.rejectedWith({
        errors: {
          password: {
            name: 'ValidatorError',
            message: 'Path `password` is required.',
          },
        },
      });
    });

    it('should fail if the e-mail is empty', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: '',
      }).should.be.rejectedWith({
        errors: {
          email: {
            name: 'ValidatorError',
            message: 'Path `email` is required.',
          },
        },
      });
    });

    it('should fail if the e-mail is already registered', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });

      await User.create({
        username: 'test2',
        password: 'secret',
        email: 'test@example.com',
      }).should.be.rejectedWith({
        errors: {
          email: {
            name: 'ValidatorError',
            message: 'E-mail is already registered',
          },
        },
      });
    });

    it('should be case insensitive in e-mail', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });

      await User.create({
        username: 'test2',
        password: 'secret',
        email: 'Test@example.com',
      }).should.be.rejectedWith({
        errors: {
          email: {
            name: 'ValidatorError',
            message: 'E-mail is already registered',
          },
        },
      });
    });

    it('should fail if the e-mail is invalid', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example',
      }).should.be.rejectedWith({
        errors: {
          email: {
            name: 'ValidatorError',
            message: 'E-mail is invalid',
          },
        },
      });
    });

    it('should fail if the nickname is already in use', async () => {
      await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
        nicknames: ['nick1', 'nick2'],
      });

      await User.create({
        username: 'test2',
        password: 'secret',
        email: 'test2@example.com',
        nicknames: ['nick2', 'nick3'],
      }).should.be.rejectedWith({
        errors: {
          nicknames: {
            name: 'ValidatorError',
            message: 'Nickname is already in use',
          },
        },
      });
    });
  });

  describe('#setPassword', () => {
    it('should change the password', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });
      user.password = 'newsecret';

      user.isValidPassword('secret').should.be.equal(
          false,
          'Current password is the old password');
      user.isValidPassword('newsecret').should.be.equal(
          true,
          'Current password is not the new password');
    });

    it('should change the salt', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });

      const oldSalt = user.salt;
      user.password = 'secret';

      oldSalt.should.not.be.equal(
          user.salt,
          'Password salt did not changed');
    });

    it('should fail if the password is empty', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });
      await user.save();

      user.password = '';

      await user.save().should.be.rejectedWith({
        errors: {
          password: {
            name: 'ValidatorError',
            message: 'Path `password` is required.',
          },
        },
      });

      const user2 = await User.findOne({
        username: 'test',
      });
      user2.isValidPassword('secret').should.be.equal(
          true,
          'Current password is not the old password');
    });
  });

  describe('#isValidPassword', () => {
    it('should return true if the password is the same', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });
      user.isValidPassword('secret').should.be.equal(
          true,
          'Returned false even though password is the same');
    });

    it('should return false if the password is not the same', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });
      user.isValidPassword('').should.be.equal(
          false,
          'Returned true even though password is not the same');
    });
  });

  describe('#recover', () => {
    it('should create a recovery code', async () => {
      const user = await User.create({
        username: 'test',
        password: 'secret',
        email: 'test@example.com',
      });

      should.not.exist(user.recoverCode, 'Recover code exists');
      await user.recover();
      user.recoverCode.should.not.be.empty().and.have.lengthOf(
          32,
          'Recover code is empty');
    });
  });
});
