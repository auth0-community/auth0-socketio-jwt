var Q = require('q');
var fixture = require('./fixture');
var request = require('request');
var io = require('socket.io-client');

describe('authorizer', function() {
  //start and stop the server
  before(function(done) { fixture.start({ }, done) });
  after(fixture.stop);

  describe('when the user is not logged in', function () {
    it('should emit error with unauthorized handshake', function (done){
      var socket = io.connect('http://localhost:9000?token=boooooo', {
        'forceNew': true
      });

      socket.on('error', function(err){
        err.message.should.eql("jwt malformed");
        err.code.should.eql("invalid_token");
        socket.close();
        done();
      });
    });
  });

  describe('when the user is logged in', function() {
    before(function (done) {
      request.post({
        url: 'http://localhost:9000/login',
        form: { username: 'jose', password: 'Pa123' },
        json: true
      }, function (err, resp, body) {
        this.token = body.token;
        done();
      }.bind(this));
    });

    describe('authorizer disallows query string token when specified in startup options', function() {
      before(function(done) {
        Q.ninvoke(fixture, 'stop')
          .then(function() { return Q.ninvoke(fixture, 'start', { auth_header_required: true })})
          .done(done);
      })
      after(function(done) {
        Q.ninvoke(fixture, 'stop')
          .then(function() { return Q.ninvoke(fixture, 'start', { })})
          .done(done);
      })

      it('auth headers are supported', function (done){
        var socket = io.connect('http://localhost:9000', {
          'forceNew':true,
          'extraHeaders': {'Authorization': 'Bearer ' + this.token}
        });
        socket.on('connect', function(){
          socket.close();
          done();
        }).on('error', done);
      });

      it('auth token in query string is disallowed', function (done){
        var socket = io.connect('http://localhost:9000', {
          'forceNew':true,
          'query': 'token=' + this.token
        });
        socket.on('error', function(err){
          err.message.should.eql("Server requires Authorization Header");
          err.code.should.eql("missing_authorization_header");
          socket.close();
          done();
        });
      });
    })

    describe('authorizer all auth types allowed', function() {
      before(function(done) {
        Q.ninvoke(fixture, 'stop')
          .then(function() { return Q.ninvoke(fixture, 'start', {})})
          .done(done);
      })

      it('auth headers are supported', function (done){
        var socket = io.connect('http://localhost:9000', {
          'forceNew':true,
          'extraHeaders': {'Authorization': 'Bearer ' + this.token}
        });
        socket.on('connect', function(){
          socket.close();
          done();
        }).on('error', done);
      });

      it('should do the handshake and connect', function (done){
        var socket = io.connect('http://localhost:9000', {
          'forceNew':true,
          'query': 'token=' + this.token
        });
        socket.on('connect', function(){
          socket.close();
          done();
        }).on('error', done);
      });
    });
  });

  describe('unsgined token', function() {
    beforeEach(function () {
      this.token = 'eyJhbGciOiJub25lIiwiY3R5IjoiSldUIn0.eyJuYW1lIjoiSm9obiBGb28ifQ.';
    });

    it('should not do the handshake and connect', function (done){
      var socket = io.connect('http://localhost:9000', {
        'forceNew':true,
        'query': 'token=' + this.token
      });
      socket.on('connect', function () {
        socket.close();
        done(new Error('this shouldnt happen'));
      }).on('error', function (err) {
        socket.close();
        err.message.should.eql("jwt signature is required");
        done();
      });
    });
  });
});
