[![Build Status](https://travis-ci.org/auth0/socketio-jwt.svg)](https://travis-ci.org/auth0/socketio-jwt)

Authenticate socket.io incoming connections with JWTs. This is useful if you are build a single page application and you are not using cookies as explained in this blog post: [Cookies vs Tokens. Getting auth right with Angular.JS](http://blog.auth0.com/2014/01/07/angularjs-authentication-with-cookies-vs-token/).

## Installation

```
npm install socketio-jwt
```

## Example usage

```javascript
// set authorization for socket.io
io.sockets
  .on('connection', socketioJwt.authorize({
    secret: 'your secret or public key',
    timeout: 15000 // 15 seconds to send the authentication message
  })).on('authenticated', function(socket) {
    //this socket is authenticated, we are good to handle more events from it.
    console.log('hello! ' + socket.decoded_token.name);
  });
```

**Note:** If you are using a base64-encoded secret (e.g. your Auth0 secret key), you need to convert it to a Buffer: `Buffer('your secret key', 'base64')`

__Client side__:

```javascript
var socket = io.connect('http://localhost:9000');
socket.on('connect', function (socket) {
  socket
    .on('authenticated', function () {
      //do other things
    })
    .emit('authenticate', {token: jwt}); //send the jwt
});
```

## One roundtrip

The previous approach uses a second roundtrip to send the jwt, there is a way you can authenticate on the handshake by sending the JWT as a query string, the caveat is that intermediary HTTP servers can log the url.

```javascript
var io            = require("socket.io")(server);
var socketioJwt   = require("socketio-jwt");

//// With socket.io < 1.0 ////
io.set('authorization', socketioJwt.authorize({
  secret: 'your secret or public key',
  handshake: true
}));
//////////////////////////////

//// With socket.io >= 1.0 ////
io.use(socketioJwt.authorize({
  secret: 'your secret or public key',
  handshake: true
}));
///////////////////////////////

io.on('connection', function (socket) {
  // in socket.io < 1.0
  console.log('hello!', socket.handshake.decoded_token.name);

  // in socket.io 1.0
  console.log('hello! ', socket.decoded_token.name);
})
```

For more validation options see [auth0/jsonwebtoken](https://github.com/auth0/node-jsonwebtoken).

__Client side__:

Append the jwt token using query string:

```javascript
var socket = io.connect('http://localhost:9000', {
  'query': 'token=' + your_jwt
});
```

## Handling token expiration

__Server side__:

When you sign the token with an expiration time:

```javascript
var token = jwt.sign(user_profile, jwt_secret, {expiresInMinutes: 60});
```

Your client-side code should handle it as below.

__Client side__:

```javascript
socket.on("error", function(error) {
  if (error.type == "UnauthorizedError" || error.code == "invalid_token") {
    // redirect user to login page perhaps?
    console.log("User's token has expired");
  }
});
```
## Getting the secret dynamically
You can pass a function instead of an string when configuring secret.
This function receives the request, the decoded token and a callback. This
way, you are allowed to use a different secret based on the request and / or
the provided token.

__Server side__:

```javascript
var SECRETS = {
  'user1': 'secret 1',
  'user2': 'secret 2'
}

io.use(socketioJwt.authorize({
  secret: function(request, decodedToken, callback) {
    // SECRETS[decodedToken.userId] will be used a a secret or
    // public key for connection user.

    callback(null, SECRETS[decodedToken.userId]);
  },
  handshake: false
}));

```

## Contribute

You are always welcome to open an issue or provide a pull-request!

Also check out the unit tests:
```bash
npm test
```

## Issue Reporting

If you have found a bug or if you have a feature request, please report them at this repository issues section. Please do not report security vulnerabilities on the public GitHub issue tracker. The [Responsible Disclosure Program](https://auth0.com/whitehat) details the procedure for disclosing security issues.

## Author

[Auth0](auth0.com)

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
