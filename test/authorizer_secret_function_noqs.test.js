var fixture = require('./fixture/secret_function');
var request = require('request');
var io      = require('socket.io-client');

describe('authorizer with secret function', function () {

  //start and stop the server
  before(function (done) {
    fixture.start({
      handshake: false
    }, done);
  });

  after(fixture.stop);

  describe('when the user is not logged in', function () {
    describe('and when token is not valid', function () {
      beforeEach(function (done) {
        request.post({
          url: 'http://localhost:9000/login',
          json: { username: 'invalid_signature', password: 'Pa123' }
        }, function (err, resp, body) {
          this.invalidToken = body.token;
          done();
        }.bind(this));
      });

      it('should emit unauthorized', function (done) {
        var socket = io.connect('http://localhost:9000', {
          'forceNew': true
        });

        var invalidToken = this.invalidToken;
        socket.on('unauthorized', function () {
          done();
        });

        socket.on('connect', function () {
          socket
            .emit('authenticate', { token: invalidToken + 'nottherighttoken' });
        });
      });
    });
  });

  describe('when the user is logged in', function () {
    beforeEach(function (done) {
      request.post({
        url: 'http://localhost:9000/login',
        json: { username: 'valid_signature', password: 'Pa123' }
      }, function (err, resp, body) {
        this.token = body.token;
        done();
      }.bind(this));
    });

    it('should do the handshake and connect', function (done) {
      var socket = io.connect('http://localhost:9000', {
        'forceNew': true
      });
      var token  = this.token;
      socket.on('connect', function () {
        socket.on('echo-response', function () {
          socket.close();
          done();
        }).on('authenticated', function () {
          socket.emit('echo');
        })
          .emit('authenticate', { token: token });
      });
    });
  });
});