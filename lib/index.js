var xtend = require('xtend');
var jwt = require('jsonwebtoken');
var UnauthorizedError = require('./UnauthorizedError');

function noQsMethod(options) {
  var defaults = { required: true };
  options = xtend(defaults, options);

  return function (socket) {
    var server = this.server || socket.server;

    if (!server.$emit) {
      //then is socket.io 1.0
      var Namespace = Object.getPrototypeOf(server.sockets).constructor;
      if (!~Namespace.events.indexOf('authenticated')) {
        Namespace.events.push('authenticated');
      }
    }

    if(options.required){
      var auth_timeout = setTimeout(function () {
        socket.disconnect('unauthorized');
      }, options.timeout || 5000);
    }

    socket.on('authenticate', function (data) {
      if(options.required){
        clearTimeout(auth_timeout);
      }
      // error handler
      var onError = function(err, code) {
          if (err) {
            code = code || 'unknown';
            var error = new UnauthorizedError(code, {
              message: (Object.prototype.toString.call(err) === '[object Object]' && err.message) ? err.message : err
            });
            socket.emit('unauthorized', error, function() {
              socket.disconnect('unauthorized');
            });
            return; // stop logic, socket will be close on next tick
          }
      };

      if(typeof data.token !== "string") {
        return onError({message: 'invalid token datatype'}, 'invalid_token');
      }

      var onJwtVerificationReady = function(err, decoded) {

        if (err) {
          return onError(err, 'invalid_token');
        }

        // success handler
        var onSuccess = function() {
          socket.decoded_token = decoded;
          socket.decodedToken = decoded;
          socket.emit('authenticated');
          if (server.$emit) {
            server.$emit('authenticated', socket);
          } else {
            //try getting the current namespace otherwise fallback to all sockets.
            var namespace = (server.nsps && socket.nsp &&
                             server.nsps[socket.nsp.name]) ||
                            server.sockets;

            // explicit namespace
            namespace.emit('authenticated', socket);
          }
        };

        if(options.additional_auth && typeof options.additional_auth === 'function') {
          options.additional_auth(decoded, onSuccess, onError);
        } else {
          onSuccess();
        }
      };

      var onSecretReady = function(err, secret) {
        if (err || !secret) {
          return onError(err, 'invalid_secret');
        }

        jwt.verify(data.token, secret, options, onJwtVerificationReady);
      };

      getSecret(socket.request, options.secret, data.token, onSecretReady);
    });
  };
}

function authorize(options, onConnection) {
  if (!options.handshake) {
    return noQsMethod(options);
  }

  var defaults = {
    success: function(data, accept){
      if (data.request) {
        accept();
      } else {
        accept(null, true);
      }
    },
    fail: function(error, data, accept){
      if (data.request) {
        accept(error);
      } else {
        accept(null, false);
      }
    }
  };

  var auth = xtend(defaults, options);

  return function(data, accept){
    var token, error;
    var req = data.request || data;
    var authorization_header = (req.headers || {}).authorization;

    if (authorization_header) {
      var parts = authorization_header.split(' ');
      if (parts.length == 2) {
        var scheme = parts[0],
          credentials = parts[1];

        if (scheme.toLowerCase() === 'bearer') {
          token = credentials;
        }
      } else {
        error = new UnauthorizedError('credentials_bad_format', {
          message: 'Format is Authorization: Bearer [token]'
        });
        return auth.fail(error, data, accept);
      }
    }

    //get the token from query string
    if (req._query && req._query.token) {
      token = req._query.token;
    }
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      error = new UnauthorizedError('credentials_required', {
        message: 'No Authorization header was found'
      });
      return auth.fail(error, data, accept);
    }

    var onJwtVerificationReady = function(err, decoded) {

      if (err) {
        error = new UnauthorizedError(err.code || 'invalid_token', err);
        return auth.fail(error, data, accept);
      }

      data.decoded_token = decoded;
      data.decodedToken = decoded;

      return auth.success(data, accept);
    };

    var onSecretReady = function(err, secret) {
      if (err) {
        error = new UnauthorizedError(err.code || 'invalid_secret', err);
        return auth.fail(error, data, accept);
      }

      jwt.verify(token, secret, options, onJwtVerificationReady);
    };

    getSecret(req, options.secret, token, onSecretReady);
  };
}

function getSecret(request, secret, token, callback) {
  if (typeof secret === 'function') {
    if (!token) {
      return callback({ code: 'invalid_token', message: 'jwt must be provided' });
    }

    var parts = token.split('.');

    if (parts.length < 3) {
      return callback({ code: 'invalid_token', message: 'jwt malformed' });
    }

    if (parts[2].trim() === '') {
      return callback({ code: 'invalid_token', message: 'jwt signature is required' });
    }

    var decodedToken = jwt.decode(token);

    if (!decodedToken) {
      return callback({ code: 'invalid_token', message: 'jwt malformed' });
    }

    secret(request, decodedToken, callback);
  } else {
    callback(null, secret);
  }
};

exports.authorize = authorize;
