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


const mongoose = require('mongoose');
const crypto = require('crypto');
const request = require('request');
const cheerio = require('cheerio');
const zlib = require('zlib');
const numeral = require('numeral');
const moment = require('moment-timezone');

const Server = require('./server');
const Country = require('./country');
const ProductDonation = require('./product-donation');
const BatchProductDonation = require('./batch-product-donation');


const secret = process.env.SECRET_KEY || process.env.OPENSHIFT_SECRET_TOKEN;

function cipherValue(value) {
  if (!value) {
    return null;
  }

  const cipher = crypto.createCipher('aes-256-cbc', secret);
  return cipher.update(value, 'binary', 'base64') + cipher.final('base64');
}

function decipherValue(value) {
  if (!value) {
    return null;
  }

  const decipher = crypto.createDecipher('aes-256-cbc', secret);
  return decipher.update(value, 'base64', 'binary') + decipher.final('binary');
}

const organizationSchema = new mongoose.Schema({
  country: {type: mongoose.Schema.Types.ObjectId, ref: 'Country'},
  username: {type: String, required: true},
  password: {
    type: String,
    required: true,
    get: decipherValue,
    set: cipherValue,
  },
  shortname: {
    type: String, required: true, lowercase: true,
    validate: {
      validator: /^[a-z]{2,3}$/i,
      msg: 'Short username should be two or three letters',
    },
  },
  cookies: {
    type: String,
    get: decipherValue,
    set: cipherValue,
  },
  lock: {
    type: Date,
    default: null,
  },
});

organizationSchema.path('username').validate(function(value, respond) {
  Organization.find({
    _id: {$ne: this._id},
    username: value,
    country: this.country,
  }, function(error, organizations) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (organizations.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Organization username with the same country already exists');

organizationSchema.path('shortname').validate(function(value, respond) {
  Organization.find({
    _id: {$ne: this._id},
    shortname: value,
    country: this.country,
  }, function(error, organizations) {
    if (error) {
      console.log(error);
      return respond(false);
    }

    if (organizations.length) {
      respond(false);
    } else {
      respond(true);
    }
  });
}, 'Organization short username with the same country already exists');

function populateCountry(self, callback) {
  Country.populate(self, {
    path: 'country',
  }, callback);
}

function populateServer(self, callback) {
  if (!self.country._id) {
    populateCountry(self, function(error) {
      if (error) {
        callback(error);
        return;
      }

      populateServer(self, callback);
    });
    return;
  }

  Server.populate(self, {
    path: 'country.server',
  }, callback);
}

organizationSchema.methods.createRequest = function(callback) {
  const self = this;

  function createRequest() {
    const jar = request.jar();
    if (self.cookies) {
      jar.setCookie(self.cookies, self.country.server.address);
    }

    const req = request.defaults({
      jar: jar,
      followAllRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:30.0) ' +
            'Gecko/20100101 Firefox/30.0',
        'Accept': 'text/html,application/xhtml+xml,' +
            'application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    callback(null, function(uri, options, c) {
      if (typeof c === 'undefined') {
        c = options;
        options = {};
      }

      const r = req(uri, options);

      r.on('response', function(res) {
        const chunks = [];
        res.on('data', function(chunk) {
          chunks.push(chunk);
        });

        res.on('end', function() {
          const buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          if (encoding === 'gzip') {
            zlib.gunzip(buffer, function(error, decoded) {
              c(error, res, decoded && decoded.toString());
            });
          } else if (encoding === 'deflate') {
            zlib.inflate(buffer, function(error, decoded) {
              c(error, res, decoded && decoded.toString());
            });
          } else {
            c(null, res, buffer.toString());
          }
        });
      });

      r.on('error', function(error) {
        c(error);
      });
    }, jar);
  }

  if (this.country._id && this.country.server._id) {
    createRequest();
  } else {
    populateServer(self, function(error) {
      if (error) {
        callback(error);
        return;
      }

      createRequest();
    });
  }
};

organizationSchema.methods.login = function(callback) {
  const self = this;

  function login(request, jar, retries) {
    const url = self.country.server.address + '/login.html';
    request(url, {
      method: 'POST',
      form: {
        login: self.username,
        password: self.password,
        remember: 'true',
        submit: 'Login',
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if ($('a#userName').length) {
          self.cookies =
              jar.getCookieString(self.country.server.address);
          self.save(function(error) {
            callback(error);
          });
        } else if (retries) {
          login(request, jar, --retries);
        } else if ($('div.testDivred').length) {
          const msg = $('div.testDivred').text().trim();

          if (msg ===
              'Wrong password. Please pay attention to upper and lower case!') {
            self.lock = moment().add(1, 'days').toDate();
            self.save(function(error) {
              callback('Failed to login, locked');
            });
            return;
          }

          callback(msg);
        } else {
          callback('Failed to login');
        }
      } else if (retries) {
        login(request, jar, --retries);
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  }

  if (self.lock && moment().isBefore(self.lock)) {
    callback('Locked, try again after ' + moment(self.lock).toNow(true));
    return;
  }

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    const url = self.country.server.address;
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if ($('a#userName').length) {
          callback(null);
        } else {
          login(request, jar, 3);
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.logout = function(callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    const url = self.country.server.address + '/logout.html';
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if ($('div#loginContainer').length) {
          callback(null);
        } else {
          callback('Failed to logout');
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.donateProducts = function(
        sender, citizenId, product, quantity, reason, callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    if (self.country.getUserAccessLevel(sender) < 1) {
      callback('Permission denied.');
      return;
    }

    const url = self.country.server.address + '/donateProducts.html';
    request(url, {
      method: 'POST',
      qs: {
        id: citizenId,
      },
      form: {
        product: product,
        quantity: quantity,
        reason: reason,
        submit: 'Donate',
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if (!$('a#userName').length) {
          self.login(function(error) {
            if (error) {
              callback(error);
              return;
            }

            self.donateProducts(
                                sender, citizenId, product, quantity, reason,
                                callback);
          });
        } else if ($('#citizenMessage div').text().trim() === 'Products sent') {
          ProductDonation.create({
            organization: self._id,
            sender: sender._id,
            recipient: citizenId,
            product: product,
            quantity: quantity,
            reason: reason,
          }, function(error, donation) {
            callback(error);
          });
        } else if ($('#citizenMessage div').length) {
          callback($('#citizenMessage div').text().trim());
        } else {
          callback('Failed to donate items');
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.batchDonateProducts = function(
        sender, citizenIds, product, quantity, reason, callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    if (self.country.getUserAccessLevel(sender) < 1) {
      callback('Permission denied.');
      return;
    }

    const form = {
      product: product,
      quantity: quantity,
      reason: reason,
      submit: 'Donate',
    };

    const l = citizenIds.length;
    for (let i = 0; i < l; i++) {
      form['citizen' + (i + 1)] = citizenIds[i];
    }

    const url = self.country.server.address + '/militaryUnitStorage.html';
    request(url, {
      method: 'POST',
      form: form,
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if (!$('a#userName').length) {
          self.login(function(error) {
            if (error) {
              callback(error);
              return;
            }

            self.batchDonateProducts(
              sender, citizenIds, product, quantity, reason,
              callback);
          });
        } else if ($('#citizenMessage div').text().trim() ===
                   'Products donated') {
          BatchProductDonation.create({
            organization: self._id,
            sender: sender._id,
            recipients: citizenIds,
            product: product,
            quantity: quantity,
            reason: reason,
          }, function(error, donation) {
            callback(error);
          });
        } else if ($('#citizenMessage div').length) {
          callback($('#citizenMessage div').text().trim());
        } else {
          callback('Failed to donate items');
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.getInventory = function(callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    const url = self.country.server.address + '/militaryUnitStorage.html';
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);
        if (!$('a#userName').length) {
          self.login(function(error) {
            if (error) {
              callback(error);
              return;
            }

            self.getInventory(callback);
          });
        }

        let l = 0;

        const inventoryOrg = {};
        const storageOrg = $('div.storageMini');
        l = storageOrg.length;
        for (let i = 0; i < l; i++) {
          const images = storageOrg.eq(i).find('img');

          let product = images.eq(0).attr('src');
          product = product.substring(
            product.lastIndexOf('/') + 1,
            product.lastIndexOf('.'));

          let quality = images.eq(1).attr('src');
          if (quality) {
            quality = parseInt(quality.substring(
              quality.lastIndexOf('/') + 2,
              quality.lastIndexOf('.')));
          }

          inventoryOrg[product + (quality ? '-' + quality : '')] =
            parseInt(storageOrg.eq(i).find('div').eq(0).text());
        }

        const inventoryMu = {};
        const storageMu = $('div.storage');
        l = storageMu.length;
        for (let i = 0; i < l; i++) {
          const images = storageMu.eq(i).find('img');

          let product = images.eq(0).attr('src');
          product = product.substring(
            product.lastIndexOf('/') + 1,
            product.lastIndexOf('.'));

          let quality = images.eq(1).attr('src');
          if (quality) {
            quality = parseInt(quality.substring(
              quality.lastIndexOf('/') + 2,
              quality.lastIndexOf('.')));
          }

          inventoryMu[product + (quality ? '-' + quality : '')] =
            parseInt(storageMu.eq(i).find('div').eq(0).text());
        }

        callback(null, inventoryOrg, inventoryMu);
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.getBattleInfo = function(battleId, callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    const url = self.country.server.address + '/battle.html';
    request(url, {
      method: 'GET',
      qs: {
        id: battleId,
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const $ = cheerio.load(body);

        if ($('div#mainFight div#fightName span').length) {
          let type = null;
          let label = null;
          let id = 0;
          let frozen = false;
          let defender = $('div#mainFight div.alliesList').eq(0).clone()
                .children().remove().end().text().trim();
          const attacker = $('div#mainFight div.alliesList').eq(1).clone()
                .children().remove().end().text().trim();

          if ($('div#newFightView div.testDivred').text().trim()
              .includes('frozen')) {
            frozen = true;
          }

          if ($('div#mainFight div#fightName span a[href*="region"]').text()
              .trim() !== '') {
            label = $('div#mainFight div#fightName span a[href*="region"]')
              .text().trim();
            id = parseInt(
              $('div#mainFight div#fightName span a[href*="region.html"]')
              .attr('href').split('=')[1]);

            if (!$('div#mainFight div#fightName span div').text().trim()
                .includes('Resistance war')) {
              type = 'direct';
            } else {
              type = 'resistance';
            }
          } else if ($('div#mainFight div#fightName span a[href*="tournament"]')
                     .text().trim() !== '') {
            label = $('div#mainFight div#fightName span a[href*="tournament"]')
              .text().trim() + ' (' + defender + ' vs. ' + attacker + ')';
            id = parseInt(
              $('div#mainFight div#fightName span a[href*="tournament"]')
              .attr('href').split('=')[1]);
            type = 'tournament';
          } else if ($('div#mainFight div#fightName span a[href*="civilWar"]')
                     .text().trim() !== '') {
            label = 'Civil War (' + defender + ')';
            id = parseInt(
              $('div#mainFight div#fightName span a[href*="civilWar"]')
              .attr('href').split('=')[1]);
            type = 'civil';
            defender = 'Loyalists';
          } else {
            label = 'Practice Battle';
            type = 'practice';
          }

          callback(null, {
            label: label,
            type: type,
            id: id,
            frozen: frozen,
            round: numeral().unformat($('div#mainFight > div').eq(2).text()
              .trim()),
            roundId: parseInt($('input#battleRoundId').attr('value')),
            defender: defender,
            defenderWins: $('div.fightRounds img[src$="blue_ball.png"]').length,
            defenderAllies: $('div#mainFight div.alliesPopup').eq(0).text()
              .trim().split(/\s{2,}/g),
            attacker: attacker,
            attackerWins: $('div.fightRounds img[src$="red_ball.png"]').length,
            attackerAllies: $('div#mainFight div.alliesPopup').eq(1).text()
              .trim().split(/\s{2,}/g),
          });
        } else if (!$('a#userName').length) {
          self.login(function(error) {
            if (error) {
              callback(error);
              return;
            }

            self.getBattleInfo(battleId, callback);
          });
        } else if ($('div.testDivwhite h3').length) {
          callback($('div.testDivwhite h3').text().trim());
        } else {
          callback('Failed to get battle information');
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

organizationSchema.methods.getBattleRoundInfo =
function(battleRoundId, callback) {
  const self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    const url = self.country.server.address + '/battleScore.html';
    request(url, {
      method: 'GET',
      qs: {
        id: battleRoundId,
        at: 0,
        ci: 0,
      },
    }, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        try {
          const battleRoundInfo = JSON.parse(body);

          callback(null, battleRoundInfo);
          return;
        } catch (e) {
          const $ = cheerio.load(body);

          if ($('div.testDivwhite h3').length) {
            callback($('div.testDivwhite h3').text().trim());
          } else {
            callback('Failed to get battle round information');
            console.log('Error: ' + e);
            console.log('Stack: ' + e.stack);
          }
        }
      } else {
        callback(error || 'HTTP Error: ' + response.statusCode);
      }
    });
  });
};

/* jshint -W003 */
const Organization = mongoose.model('Organization', organizationSchema);
/* jshint +W003 */
module.exports = Organization;
