const fs = require('fs');
var fixture = require('./fixture/jwks_function');
var request = require('request');
var io = require('socket.io-client');
var jwt = require('jsonwebtoken');

const privateKey = fs.readFileSync(`${__dirname}/fixture/jwtRS256.key`, "utf8");

describe('authorizer with JWKS url', function () {

  //start and stop the server
  before(fixture.start);
  after(fixture.stop);

  describe('when the kid matches', function () {

    it('should do the handshake and connect', function (done){
      jwt.sign({}, privateKey,  {keyid: 'test_kid', algorithm: 'RS256'}, (err, token) => {
        const socket = io.connect('http://localhost:9000', {
          'forceNew': true,
          'query': 'token=' + token
        });
        socket.on('connect', function () {
          socket.close();
          done();
        }).on('error', done);
      });
    });

  });

  describe('when the kid does not match', function () {

    it('should do the handshake and connect', function (done){
      jwt.sign({}, privateKey,  {keyid: 'test_badkid', algorithm: 'RS256'}, (err, token) => {
        const socket = io.connect('http://localhost:9000', {
          'forceNew': true,
          'query': 'token=' + token
        });
        socket.on('error', function(err){
          err.message.should.eql("no match found for kid");
          err.code.should.eql("jwks_error");
          socket.close();
          done();
        });
      });
    });
  });
});
