const fixture = require('./fixture/secret_function_arity3');
const request = require('request');
const io = require('socket.io-client');

describe('authorizer with secret function (arity 3)', () => {

  //start and stop the server
  before(fixture.start);
  after(fixture.stop);

  describe('when the user is not logged in', () => {

    it('should emit error with unauthorized handshake', (done) => {
      const socket = io.connect('http://localhost:9000?token=boooooo', { forceNew: true });

      socket.on('error', (err) => {
        err.message.should.eql('jwt malformed');
        err.code.should.eql('invalid_token');
        socket.close();
        done();
      });
    });

  });

  describe('when the user is logged in', () => {

    beforeEach((done) => {
      request.post({
        url: 'http://localhost:9000/login',
        json: { username: 'valid_signature', password: 'Pa123' }
      }, (err, resp, body) => {
        this.token = body.token;
        done();
      });
    });

    it('should do the handshake and connect', (done) => {
      const socket = io.connect('http://localhost:9000', {
        forceNew: true,
        query: 'token=' + this.token
      });

      socket
        .on('connect', () => {
          socket.close();
          done();
        })
        .on('error', done);
    });
  });

  describe('unsigned token', () => {
    beforeEach(() => {
      this.token = 'eyJhbGciOiJub25lIiwiY3R5IjoiSldUIn0.eyJuYW1lIjoiSm9obiBGb28ifQ.';
    });

    it('should not do the handshake and connect', (done) => {
      const socket = io.connect('http://localhost:9000', {
        forceNew: true,
        query: 'token=' + this.token
      });

      socket
        .on('connect', () => {
          socket.close();
          done(new Error('this shouldnt happen'));
        })
        .on('error', (err) => {
          socket.close();
          err.message.should.eql('jwt signature is required');
          done();
        });
    });
  });

});
