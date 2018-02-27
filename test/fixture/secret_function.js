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
  var SECRETS = {
    123: 'aaafoo super sercret',
    555: 'other'
  };

  if(typeof options == 'function'){
    callback = options;
    options = {};
  }

  options = xtend({
    secret: function(request, decodedToken, callback) {
      callback(null, SECRETS[decodedToken.id]);
    },
    timeout: 1000,
    handshake: true
  }, options);

  var app = express();

  app.use(bodyParser.json());

  app.post('/login', function (req, res) {
    var profile = getProfile(req.body);

    // We are sending the profile inside the token
    var token = jwt.sign(profile, SECRETS[123], { expiresIn: 60*60*5 });

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

const getProfile = function (body) {
  var profile = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@doe.com'
  };
  if (body.password.indexOf('sf_id') > -1) {
      profile.id = body.username === 'valid_signature' ? 123 : 555;
      profile.salesforce_id = body.password === 'no_sf_id' ? null : 'salesforceId';
      return profile;
  } else if (body.password.indexOf('client_id') > -1) {
    profile.id = body.username === 'valid_signature' ? 123 : 555;
    profile.client_id = body.password === 'no_client_id' ? null : 'clientId';
    return profile;
  }

  return {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@doe.com',
    id: body.username === 'valid_signature' ? 123 : 555,
    salesforce_id: body.password === 'no_sf_id' ? null : 'salesforceId'
  }
};

exports.stop = function (callback) {
  sio.close();
  try {
    server.destroy();
  } catch (er) {}

  callback();
};

