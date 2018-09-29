var express = require('express');
var http = require('http');

var socketIo = require('socket.io');
var socketio_jwt = require('../../lib');

var jwt = require('jsonwebtoken');

var bodyParser = require('body-parser');

var server, sio;
var enableDestroy = require('server-destroy');

exports.start = function (options, callback) {

  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  options = {
    secret: 'aaafoo super sercret',
    timeout: 1000,
    handshake: true,
      ...options};

  var app = express();

  app.use(bodyParser.json());

  app.post('/login', function (req, res) {
    var profile = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@doe.com',
      id: 123
    };

    // We are sending the profile inside the token
    var token = jwt.sign(profile, options.secret, { expiresIn: 60*5 });

    res.json({token: token});
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
