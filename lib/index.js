const jwt = require('jsonwebtoken');
const get = require('simple-get');
const UnauthorizedError = require('./UnauthorizedError');

function noQsMethod(options) {
  options = { required: true, ...options};

  return function (socket) {
    const server = this.server || socket.server;

    if (!server.$emit) {
      //then is socket.io 1.0
      const Namespace = Object.getPrototypeOf(server.sockets).constructor;
      if (!~Namespace.events.indexOf('authenticated')) {
        Namespace.events.push('authenticated');
      }
    }

    let auth_timeout;
    if(options.required){
      auth_timeout = setTimeout(function () {
        socket.disconnect('unauthorized');
      }, options.timeout || 5000);
    }

    socket.on('authenticate', function (data) {
      if(options.required){
        clearTimeout(auth_timeout);
      }
      // error handler
      const onError = function(err, code) {
          if (err) {
            code = code || 'unknown';
            const error = new UnauthorizedError(code, {
              message: (Object.prototype.toString.call(err) === '[object Object]' && err.message) ? err.message : err
            });
            let callback_timeout;
            // If callback explicitly set to false, start timeout to disconnect socket
            if (options.callback === false || typeof options.callback === "number") {
              if (typeof options.callback === "number") {
                if (options.callback < 0) {
                  // If callback is negative(invalid value), make it positive
                  options.callback = Math.abs(options.callback);
                }
              }
              callback_timeout = setTimeout(function () {
                socket.disconnect('unauthorized');
              }, (options.callback === false ? 0 : options.callback));
            }
            socket.emit('unauthorized', error, function() {
              if (typeof options.callback === "number") {
                clearTimeout(callback_timeout);
              }
              socket.disconnect('unauthorized');
            });
            // stop logic, socket will be close on next tick
          }
      };

      if(!data || typeof data.token !== "string") {
        return onError({message: 'invalid token datatype'}, 'invalid_token');
      }

      const onJwtVerificationReady = function(err, decoded) {

        if (err) {
          return onError(err, 'invalid_token');
        }

        // success handler
        const onSuccess = function() {
          socket[options.decodedPropertyName] = decoded;
          socket.emit('authenticated');
          if (server.$emit) {
            server.$emit('authenticated', socket);
          } else {
            //try getting the current namespace otherwise fallback to all sockets.
            const namespace = (server.nsps && socket.nsp &&
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

      const onSecretReady = function(err, secret) {
        if (err || !secret) {
          return onError(err, 'invalid_secret');
        }

        jwt.verify(data.token, secret, options, onJwtVerificationReady);
      };

      getSecret(socket.request, options.secret, data.token, onSecretReady);
    });
  };
}

function getJWKSSecret (jwksUrl) {
  return function (request, decodedToken, jwtHeader, callback) {
    get.concat({
      method: 'GET',
      url: jwksUrl,
      json: true
    }, function (err, res, data) {
      if (err){
        return callback({ code: 'jwks_error', message: 'error getting jwks information' });
      }
      const {keys} = data;
      const match = keys.find(k => k.kid === jwtHeader.kid);
      if (!match) {
        return callback({ code: 'jwks_error', message: 'no match found for kid' });
      }
      callback(null, '-----BEGIN CERTIFICATE-----\n'+match.x5c[0]+'\n-----END CERTIFICATE-----\n');
    })
  }
}

const getAuthorizer = options => ({
  success: (data, accept) => {
    if (data.request) {
      accept();
    } else {
      accept(null, true);
    }
  },
  fail: (error, data, accept) => {
    if (data.request) {
      accept(error);
    } else {
      accept(null, false);
    }
  },
  decodedPropertyName: 'decoded_token',
  ...options
});


const getSecretReadyHandler = (accept, auth, data, token, options) => (err, secret) => {
  if (err) {
    const error = new UnauthorizedError(err.code || 'invalid_secret', err);
    return auth.fail(error, data, accept);
  }

  const verificationReadyHandler = (err, decoded) => {
    if (err) {
      const error = new UnauthorizedError(err.code || 'invalid_token', err);
      return auth.fail(error, data, accept);
    }

    data[options.decodedPropertyName] = decoded;

    return auth.success(data, accept);
  };

  jwt.verify(token, secret, options, verificationReadyHandler);
};

function authorize(options) {
  if (!options.handshake) {
    return noQsMethod({ decodedPropertyName: 'decoded_token', ...options});
  }

  const auth = getAuthorizer(options);

  return function(data, accept){
    let token, error;
    const req = data.request || data;
    const authorization_header = (req.headers || {}).authorization;

    if (authorization_header) {
      const parts = authorization_header.split(' ');
      if (parts.length === 2) {
        const scheme = parts[0],
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

    const onSecretReady = getSecretReadyHandler(accept, auth, data, token, options);

    getSecret(req, options.jwks ? getJWKSSecret(options.jwks) : options.secret, token, onSecretReady);
  };
}

function getHeaderAndPayload(token) {
  if (!token) {
    throw {code: 'invalid_token', message: 'jwt must be provided'};
  }

  const [, , signature] = token.split('.');

  if (typeof signature === 'undefined') {
    throw {code: 'invalid_token', message: 'jwt malformed'};
  }

  if (signature.trim() === '') {
    throw {code: 'invalid_token', message: 'jwt signature is required'};
  }

  const {header, payload} = jwt.decode(token, {complete: true});

  if (!payload) {
    throw {code: 'invalid_token', message: 'jwt malformed'};
  }

  return {header, payload};
}

const getFunctionArguments = (request, secret, token) => {
  const {header, payload} = getHeaderAndPayload(token);

  if (secret.length === 3) {
    return [request, payload];
  } else if (secret.length === 4) {
    return [request, payload, header];
  } else {
    throw {
      code: 'bad_secret_function',
      message: `Secret function has ${secret.length} arguments instead of 3 or 4`
    };
  }
};

function getSecret(request, secret, token, callback) {
  if (typeof secret === 'function') {
    try {
      const args = getFunctionArguments(request, secret, token);

      secret.apply(null, args.concat(callback));
    } catch (e) {
      const {message, code} = e;
      callback({code,  message});
    }
  } else {
    callback(null, secret);
  }
}

exports.authorize = authorize;
