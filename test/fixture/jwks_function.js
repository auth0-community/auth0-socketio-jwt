var express = require('express');
var http = require('http');

var socketIo = require('socket.io');
var socketio_jwt = require('../../lib');

var jwt = require('jsonwebtoken');

var xtend = require('xtend');
var bodyParser = require('body-parser');

var server, sio;
var enableDestroy = require('server-destroy');

exports.start = function (options, callback) {

  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  options = xtend({
    jwks: 'http://localhost:9000/.well-known/jwks.json',
    timeout: 1000,
    handshake: true
  }, options);

  var app = express();

  app.use(bodyParser.json());

  app.get('/.well-known/jwks.json', function (req, res) {
    res.json({
      "keys": [
        {
          "alg": "RS256",
          "kty": "RSA",
          "use": "sig",
          "x5c": [
            "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA/juKOmErHZHd79zWQ708" +
            "bBV1II2OtSTAYb+lATk4Q4VVPbDnmhvHPn0Fn2IZ0b6JgcD3PdPDyqO5202KEZ5i" +
            "iDiBiw/uhLvzp8kqLPirMcmz97KPuEvTYziD9qNHChNqDY3O1w4PnfCDiukXkdGv" +
            "cVomNDYyiW9d0rosbwm9JeLPja3duqJtVnzSv4ydQXizHGK7HUL7aHtyjuNVRGTi" +
            "sWCESmniKxKeuUyHC2ZoasbSmoai4HRrUmOKIKy3ACw99mlBzogmfOzk1HUq9mOh" +
            "lZca639PvUSaZoxifjlYohV0geh2gfCh5DYPzDfjOgUE7DtUmD/zGlwShTwauf9R" +
            "gSnld5Ycn2pGMYpWIEwh+vDN1tLCtNhEyLH4mqXRCi0P2j7FaaFjjhqO4oqlibSK" +
            "JbMKpNkcttJIv5SXpHOluSLJOo2pPJdcQb1SGizi18JtF0EFOZaPA0FWYq7xQD+m" +
            "qVKE0k8RcXRakVXgLAwAypea5cWrWJ3Qtjv9po56KYQSqW659mFD8RX4TASi0GIf" +
            "jQL3lnjLQs5rwocGx6PQb6vXOXmWT5Mg38DA0v7PzgX41AHsZbjfS6UUwDE2Wsm2" +
            "wHNKmf1YLR+fwxxIcnzjKD5k7L4cyGD/BNXpC6TsrWXmj555dyQiwovbnQSZ+I0k" +
            "bq5l7We0LID8uhf9cmqMQSMCAwEAAQ=="
          ],
          "n": "p_xUHnNOGXJoiA6kRESMglb1l3X484vCfAnOi7Ia9Gi9VHEMy9f4lWvsh-Ak3W_jhCA9WbxQN8ETvDtvpPYdmpBhgczsPwzdrlKRGthTfaQDlZSa6a4g-JQmH-xu6l8kp5ksgpz5C3ZmY1hXADDMLIkDhpApnFK9Tdgdv-UZxrUp9Ij3lGttjStQORYhhQAQwBVmj0qtgc4rjRJP7ENjLUmXbaYgSAVXCoIzcfPy-f6OoQjPQDHHcmFXdFbw8AL3mQ5Q6E5vRZkG5_qU7FQaRckW711WHuJSyjZWGBh1oosVv7UpvokFbuOmlXrcvARqx5amm6rBQaVdqY5f40p6Cw",
          "e": "AQAB",
          "kid": "test_kid",
          "x5t": "test_kid"
        },
        {
          "alg": "RS256",
          "kty": "RSA",
          "use": "sig",
          "x5c": [
            "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsf1xf4CdyR8rfTb1ePJm" +
            "S76Y0fVmvr2tIk3OQhFh59OtBGPd12Zs2XsmJxbiKptyYIP7/Dd6DFV5ZloFuHor" +
            "EOIQPfLcuAUV6pO21H1YN8U3JP7iRpRCHWgSg6Uvo9/Z68HW5sM+axw3czvCjRaD" +
            "w/u8PrhleiFNiZmRGQRsU3+on43eMnvwNuV2l/3LIzbMhhStR1Vz2bivBQ/HEfch" +
            "RNwTfxR8rCGJDfOtUbpDPOqT56GKBJ5Yv3adwFIWbHd+EoM3DzdeiTO4E+CCrh8K" +
            "94OWV2lybjNUJYEzV2HyJaAc/H0u57lP1iabnA5B6L/ssAry0TWzt0tG42M0WojX" +
            "VcBjCPhw9+0pv+T9O676gVDghCi6ZwQRcaI2SENLmi/lEkGeUXLQbkCuDpNPjDls" +
            "h+nevnHn3jhuby6mK++XQweH1iROyBlvPl0cuH7ofhn7RYDRCRcZ8sl0c/gj0OHh" +
            "R9zihcXZnKhO8mHZ7C7+yTs88bDfFUOaa6z5Cptvc5X/izcd1S8XLmrWrQHX3wbV" +
            "yOLFUlLpOi97gkNTMMLbUQODhlWPgZcR3jwNeTvWJeT33m+rJZIzhzJtU/kwu6wp" +
            "72SJqED6tfy1rwflAJ4pKgKX0w0NQyAbWt5BzhJ8WjQXPvOp5UXkwL4D0/1nNtYB" +
            "J7Nd2Q88JxSGsTsGOAyZuRECAwEAAQ=="
          ],
          "n": "p_xUHnNOGXJoiA6kRESMglb1l3X484vCfAnOi7Ia9Gi9VHEMy9f4lWvsh-Ak3W_jhCA9WbxQN8ETvDtvpPYdmpBhgczsPwzdrlKRGthTfaQDlZSa6a4g-JQmH-xu6l8kp5ksgpz5C3ZmY1hXADDMLIkDhpApnFK9Tdgdv-UZxrUp9Ij3lGttjStQORYhhQAQwBVmj0qtgc4rjRJP7ENjLUmXbaYgSAVXCoIzcfPy-f6OoQjPQDHHcmFXdFbw8AL3mQ5Q6E5vRZkG5_qU7FQaRckW711WHuJSyjZWGBh1oosVv7UpvokFbuOmlXrcvARqx5amm6rBQaVdqY5f40p6Cw",
          "e": "AQAB",
          "kid": "test_kid_bad_key",
          "x5t": "test_kid_bad_key"
        }
      ]
    });
  });

  server = http.createServer(app);

  sio = socketIo.listen(server);

  if (options.handshake) {
    sio.use(socketio_jwt.authorize(options));

    sio.sockets.on('echo', function (m) {
      sio.sockets.emit('echo-response', m);
    });
  } else {
    sio.sockets
      .on('connection', socketio_jwt.authorize(options))
      .on('authenticated', function (socket) {
        socket.on('echo', function (m) {
          socket.emit('echo-response', m);
        });
      });
  }

  server.__sockets = [];
  server.on('connection', function (c) {
    server.__sockets.push(c);
  });

  server.listen(9000, callback);
  enableDestroy(server);
};

exports.stop = function (callback) {
  sio.close();
  try {
    server.destroy();
  } catch (er) {}

  callback();
};

