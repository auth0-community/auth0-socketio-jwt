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

