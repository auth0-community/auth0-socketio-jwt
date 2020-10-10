const xtend             = require('xtend');
const jwt               = require('jsonwebtoken');
const UnauthorizedError = require('./UnauthorizedError');

function noQsMethod (options) {
  const defaults = { required: true };
  options        = xtend(defaults, options);

  return (socket) => {
    'use strict'; // Node 4.x workaround
    const server = this.server || socket.server;

    if (!server.$emit) {
      //then is socket.io 1.0
      const Namespace = Object.getPrototypeOf(server.sockets).constructor;
      if (!~Namespace.events.indexOf('authenticated')) {
        Namespace.events.push('authenticated');
      }
    }

    let auth_timeout = null;
    if (options.required) {
      auth_timeout = setTimeout(() => {
        socket.disconnect('unauthorized');
      }, options.timeout || 5000);
    }

    socket.on('authenticate', (data) => {
      if (options.required) {
        clearTimeout(auth_timeout);
      }

      // error handler
      const onError = (err, code) => {
        if (err) {
          code        = code || 'unknown';
          const error = new UnauthorizedError(code, {
            message: (Object.prototype.toString.call(err) === '[object Object]' && err.message) ? err.message : err
          });

          let callback_timeout;
          // If callback explicitly set to false, start timeout to disconnect socket
          if (options.callback === false || typeof options.callback === 'number') {
            if (typeof options.callback === 'number') {
              if (options.callback < 0) {
                // If callback is negative(invalid value), make it positive
                options.callback = Math.abs(options.callback);
              }
            }

            callback_timeout = setTimeout(() => {
              socket.disconnect('unauthorized');
            }, (options.callback === false ? 0 : options.callback));
          }

          socket.emit('unauthorized', error, () => {
            if (typeof options.callback === 'number') {
              clearTimeout(callback_timeout);
            }
            socket.disconnect('unauthorized');
          });
          return; // stop logic, socket will be close on next tick
        }
      };

      const token = options.cookie ? socket.request.cookies[options.cookie] : (data ? data.token : undefined);

      if (!token || typeof token !== 'string') {
        return onError({ message: 'invalid token datatype' }, 'invalid_token');
      }

      // Store encoded JWT
      socket[options.encodedPropertyName] = token;

      const onJwtVerificationReady = (err, decoded) => {
        if (err) {
          return onError(err, 'invalid_token');
        }

        // success handler
        const onSuccess = () => {
          socket[options.decodedPropertyName] = options.customDecoded
            ? options.customDecoded(decoded)
            : decoded;
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

        if (options.additional_auth && typeof options.additional_auth === 'function') {
          options.additional_auth(decoded, onSuccess, onError);
        } else {
          onSuccess();
        }
      };

      const onSecretReady = (err, secret) => {
        if (err || !secret) {
          return onError(err, 'invalid_secret');
        }

        jwt.verify(token, secret, options, onJwtVerificationReady);
      };

      getSecret(socket.request, options.secret, token, onSecretReady);
    });
  };
}

function authorize (options) {
  options = xtend({ decodedPropertyName: 'decoded_token', encodedPropertyName: 'encoded_token' }, options);

  if (typeof options.secret !== 'string' && typeof options.secret !== 'function' && !Buffer.isBuffer(options.secret)) {
    throw new Error(`Provided secret ${options.secret} is invalid, must be of type string or function or buffer.`);
  }

  if (!options.handshake) {
    return noQsMethod(options);
  }

  const defaults = {
    success: (socket, accept) => {
      if (socket.request) {
        accept();
      } else {
        accept(null, true);
      }
    },
    fail: (error, socket, accept) => {
      if (socket.request) {
        accept(error);
      } else {
        accept(null, false);
      }
    }
  };

  const auth = xtend(defaults, options);

  return (socket, accept) => {
    'use strict'; // Node 4.x workaround
    let token, error;

    const handshake = socket.handshake;
    const req = socket.request || socket;
    const authorization_header = (req.headers || {}).authorization;

    if (authorization_header) {
      const parts = authorization_header.split(' ');
      if (parts.length == 2) {
        const scheme      = parts[0],
              credentials = parts[1];

        if (scheme.toLowerCase() === 'bearer') {
          token = credentials;
        }
      } else {
        error = new UnauthorizedError('credentials_bad_format', {
          message: 'Format is Authorization: Bearer [token]'
        });
        return auth.fail(error, socket, accept);
      }
    }

    // Check if the header has to include authentication
    if (options.auth_header_required && !token) {
      return auth.fail(new UnauthorizedError('missing_authorization_header', {
        message: 'Server requires Authorization Header'
      }), socket, accept);
    }

    // Get the token from handshake or query string
    if (handshake && handshake.query.token) {
      token = handshake.query.token;
    }
    else if (req._query && req._query.token) {
      token = req._query.token;
    }
    else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      error = new UnauthorizedError('credentials_required', {
        message: 'no token provided'
      });
      return auth.fail(error, socket, accept);
    }

    // Store encoded JWT
    socket[options.encodedPropertyName] = token;

    const onJwtVerificationReady = (err, decoded) => {
      if (err) {
        error = new UnauthorizedError(err.code || 'invalid_token', err);
        return auth.fail(error, socket, accept);
      }

      socket[options.decodedPropertyName] = options.customDecoded
        ? options.customDecoded(decoded)
        : decoded;

      return auth.success(socket, accept);
    };

    const onSecretReady = (err, secret) => {
      if (err) {
        error = new UnauthorizedError(err.code || 'invalid_secret', err);
        return auth.fail(error, socket, accept);
      }

      jwt.verify(token, secret, options, onJwtVerificationReady);
    };

    getSecret(req, options.secret, token, onSecretReady);
  };
}

function getSecret (request, secret, token, callback) {
  'use strict'; // Node 4.x workaround

  if (typeof secret === 'function') {
    if (!token) {
      return callback({ code: 'invalid_token', message: 'jwt must be provided' });
    }

    const parts = token.split('.');

    if (parts.length < 3) {
      return callback({ code: 'invalid_token', message: 'jwt malformed' });
    }

    if (parts[2].trim() === '') {
      return callback({ code: 'invalid_token', message: 'jwt signature is required' });
    }

    let decodedToken = jwt.decode(token, { complete: true });

    if (!decodedToken) {
      return callback({ code: 'invalid_token', message: 'jwt malformed' });
    }

    const arity = secret.length;
    if (arity == 4) {
      secret(request, decodedToken.header, decodedToken.payload, callback);
    } else { // arity == 3
      secret(request, decodedToken.payload, callback);
    }
  } else {
    callback(null, secret);
  }
}

exports.authorize = authorize;
exports.UnauthorizedError = UnauthorizedError;
