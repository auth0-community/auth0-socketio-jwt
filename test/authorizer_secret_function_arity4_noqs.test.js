const fixture = require('./fixture/secret_function_arity4');
const request = require('request');
const io = require('socket.io-client');

describe('authorizer with secret function (arity 4)', () => {

  //start and stop the server
  before((done) => {
    fixture.start({
      handshake: false
    }, done);
  });

  after(fixture.stop);

  describe('when the user is not logged in', () => {

    describe('and when token is not valid', () => {
      beforeEach((done) => {
        request.post({
          url: 'http://localhost:9000/login',
          json: { username: 'invalid_signature', password: 'Pa123' }
        }, (err, resp, body) => {
          this.invalidToken = body.token;
          done();
        });
      });

      it('should emit unauthorized', (done) => {
        io.connect('http://localhost:9000', { forceNew: true })
          .on('unauthorized', () => done())
          .emit('authenticate', { token: this.invalidToken + 'ass' })
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

    it('should do the authentication and connect', (done) => {
      const socket = io.connect('http://localhost:9000', { forceNew: true });

      socket
        .on('echo-response', () => {
          socket.close();
          done();
        })
        .on('authenticated', () => { socket.emit('echo'); })
        .emit('authenticate', { token: this.token });
    });
  });

});
