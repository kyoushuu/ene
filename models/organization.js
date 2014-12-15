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


var mongoose = require('mongoose');
var crypto = require('crypto');
var request = require('request');
var cheerio = require('cheerio');
var zlib = require('zlib');

var Server = require('./server');
var Country = require('./country');
var ProductDonation = require('./product-donation');


var secret = process.env.SECRET_KEY || process.env.OPENSHIFT_SECRET_TOKEN;

function cipherValue(value) {
  if (!value) {
    return null;
  }

  var cipher = crypto.createCipher('aes-256-cbc', secret);
  return cipher.update(value, 'binary', 'base64') + cipher.final('base64');
}

function decipherValue(value) {
  if (!value) {
    return null;
  }

  var decipher = crypto.createDecipher('aes-256-cbc', secret);
  return decipher.update(value, 'base64', 'binary') + decipher.final('binary');
}

var organizationSchema = new mongoose.Schema({
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
  var self = this;

  function createRequest() {
    var jar = request.jar();
    if (self.cookies) {
      jar.setCookie(self.cookies, self.country.server.address);
    }

    var req = request.defaults({
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

      var r = req(uri, options);

      r.on('response', function(res) {
        var chunks = [];
        res.on('data', function(chunk) {
          chunks.push(chunk);
        });

        res.on('end', function() {
          var buffer = Buffer.concat(chunks);
          var encoding = res.headers['content-encoding'];
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
  var self = this;

  function login(request, jar, retries) {
    var url = self.country.server.address + '/login.html';
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
        var $ = cheerio.load(body);
        if ($('a#userName').length) {
          self.cookies =
              jar.getCookieString(self.country.server.address);
          self.save(function(error) {
            callback(error);
          });
        } else if (retries) {
          login(request, jar, --retries);
        } else if ($('div.testDivred').length) {
          callback($('div.testDivred').text().trim());
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

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    var url = self.country.server.address;
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var $ = cheerio.load(body);
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
  var self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    var url = self.country.server.address + '/logout.html';
    request(url, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var $ = cheerio.load(body);
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
  var self = this;

  this.createRequest(function(error, request, jar) {
    if (error) {
      callback(error);
    }

    var accessLevel = 0;
    var l = self.country.accessList.length;
    for (var i = 0; i < l; i++) {
      if (self.country.accessList[i].account.equals(sender._id)) {
        accessLevel = self.country.accessList[i].accessLevel;
        break;
      }
    }

    if (accessLevel < 1) {
      callback('Permission denied.');
      return;
    }

    var url = self.country.server.address + '/donateProducts.html';
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
        var $ = cheerio.load(body);
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
      } else if (error) {
        callback(error);
      } else {
        callback('HTTP Error: ' + response.statusCode);
      }
    });
  });
};

/* jshint -W003 */
var Organization = mongoose.model('Organization', organizationSchema);
/* jshint +W003 */
module.exports = Organization;
