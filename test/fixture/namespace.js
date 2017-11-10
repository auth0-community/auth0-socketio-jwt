var express = require('express');
var http = require('http');

var socketIo = require('socket.io');
var socketio_jwt = require('../../lib');

var jwt = require('jsonwebtoken');

var xtend = require('xtend');
var bodyParser = require('body-parser');

var server, sio;
var enableDestroy = require('server-destroy');

/**
 * This is an example server that shows how to do namespace authentication.
 *
 * The /admin namespace is protected by JWTs while the global namespace is public.
 */
exports.start = function (callback) {

  options = {
    secret: 'aaafoo super sercret',
    timeout: 1000,
    handshake: false
  };

  var app = express();

  app.use(bodyParser.json());

  app.post('/login', function (req, res) {
    var profile = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@doe.com',
      id: 123,
      salesforce_id: 'salesforceID'
    };

    // We are sending the profile inside the token
    var token = jwt.sign(profile, options.secret, { expiresInMinutes: 60*5 });

    res.json({token: token});
  });

  server = http.createServer(app);

  sio = socketIo.listen(server);

  sio.on('connection', function (socket) {
    socket.emit('hi');
  });

  var admin_nsp = sio.of('/admin');

  admin_nsp.on('connection', socketio_jwt.authorize(options))
           .on('authenticated', function (socket) {
              socket.emit('hi admin');
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