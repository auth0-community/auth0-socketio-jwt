var express = require('express');
var http = require('http');

var socketIo = require('socket.io');
var socketio_jwt = require('../../lib');

var bodyParser = require('body-parser');

var server, sio;
var enableDestroy = require('server-destroy');

exports.start = function (options, callback) {

  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  options = {
    jwks: 'http://localhost:9000/.well-known/jwks.json',
    timeout: 1000,
    handshake: true,
      ...options
  };

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
            "MIIFDDCCAvQCCQD99oQufDHv6DANBgkqhkiG9w0BAQsFADBIMQswCQYDVQQGEwJV" +
            "UzELMAkGA1UECAwCSUwxETAPBgNVBAcMCEV2YW5zdG9uMRkwFwYDVQQKDBBBaGFu" +
            "YSBQZWRpYXRyaWNzMB4XDTE4MTAwMjIxMjkyM1oXDTE4MTEwMTIxMjkyM1owSDEL" +
            "MAkGA1UEBhMCVVMxCzAJBgNVBAgMAklMMREwDwYDVQQHDAhFdmFuc3RvbjEZMBcG" +
            "A1UECgwQQWhhbmEgUGVkaWF0cmljczCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCC" +
            "AgoCggIBAP47ijphKx2R3e/c1kO9PGwVdSCNjrUkwGG/pQE5OEOFVT2w55obxz59" +
            "BZ9iGdG+iYHA9z3Tw8qjudtNihGeYog4gYsP7oS786fJKiz4qzHJs/eyj7hL02M4" +
            "g/ajRwoTag2NztcOD53wg4rpF5HRr3FaJjQ2MolvXdK6LG8JvSXiz42t3bqibVZ8" +
            "0r+MnUF4sxxiux1C+2h7co7jVURk4rFghEpp4isSnrlMhwtmaGrG0pqGouB0a1Jj" +
            "iiCstwAsPfZpQc6IJnzs5NR1KvZjoZWXGut/T71EmmaMYn45WKIVdIHodoHwoeQ2" +
            "D8w34zoFBOw7VJg/8xpcEoU8Grn/UYEp5XeWHJ9qRjGKViBMIfrwzdbSwrTYRMix" +
            "+Jql0QotD9o+xWmhY44ajuKKpYm0iiWzCqTZHLbSSL+Ul6RzpbkiyTqNqTyXXEG9" +
            "Uhos4tfCbRdBBTmWjwNBVmKu8UA/pqlShNJPEXF0WpFV4CwMAMqXmuXFq1id0LY7" +
            "/aaOeimEEqluufZhQ/EV+EwEotBiH40C95Z4y0LOa8KHBsej0G+r1zl5lk+TIN/A" +
            "wNL+z84F+NQB7GW430ulFMAxNlrJtsBzSpn9WC0fn8McSHJ84yg+ZOy+HMhg/wTV" +
            "6Quk7K1l5o+eeXckIsKL250EmfiNJG6uZe1ntCyA/LoX/XJqjEEjAgMBAAEwDQYJ" +
            "KoZIhvcNAQELBQADggIBAEAqgPxgSgKVr3qExE9LJ0v/o+lBLfgyshhD3Ln4vK7C" +
            "FV1GOGyus7XJC9jvSm47O9vLVNRzgsb12IR2fBrGiRDzsV56QB82WoI1WY8FeU4Q" +
            "VjLTSrv5JhVjmWIiT3BXX97NFBhmXewQY2y+My6WVrCUQLdiO51FsJsI6aqA+56U" +
            "N35gw5FYyr+IgN6pD82kgPgGuDz4pTa6axV6yZSL0JglsSbgG8tuBOlDvguxXf0s" +
            "ykRFgTx1RTTkb+DYOX5kiJG+fRrRSWTqy60IeRXNng638E906z35VOpIevy+/xMz" +
            "7eNuWhojL1mQsYX42O8M9jV8pOlMZr1mC5mOJkFWKit7lgGCizZGvZXhpp/KxxKk" +
            "JRMtMf9hWRX/W1rRW3NIwQ4zdQlrvYxkU0+FPrLVO76qR8z4JZLMiBp5LLwqplsm" +
            "qpHVKjS/AHd7JOkWmx5Ses/3TTDnEDGzkKc5a4dLXRjAXPT3+lyeFkeU7aQLQ7g7" +
            "HGo/QHeZQ4tPwc67tsZpVPhj9E9AMxWGainrYTwaNNHyWJEXMt8fFFAzF4D/Fi34" +
            "xNTqtTneen3qey4E/Jes0nBQ58gO8Mscn6NDutlHMOzZHJ6jJZvVWY0TB0MP4IBU" +
            "f0eq9s8Guc8U/sysz7UH7a3JlJKGnpOWq8nm8jn9e6MFZqSfcFngRiLar5JRJLju"
          ],
          "n": "p_xUHnNOGXJoiA6kRESMglb1l3X484vCfAnOi7Ia9Gi9VHEMy9f4lWvsh-Ak3W_jhCA9WbxQN8ETvDtvpPYdmpBhgczsPwzdrlKRGthTfaQDlZSa6a4g-JQmH-xu6l8kp5ksgpz5C3ZmY1hXADDMLIkDhpApnFK9Tdgdv-UZxrUp9Ij3lGttjStQORYhhQAQwBVmj0qtgc4rjRJP7ENjLUmXbaYgSAVXCoIzcfPy-f6OoQjPQDHHcmFXdFbw8AL3mQ5Q6E5vRZkG5_qU7FQaRckW711WHuJSyjZWGBh1oosVv7UpvokFbuOmlXrcvARqx5amm6rBQaVdqY5f40p6Cw",
          "e": "AQAB",
          "kid": "test_kid",
          "x5t": "test_kid"
        },
        {
          "alg": "RS256",
          "kty": "RSA",
          "use": "sig",
          "x5c": [
            "MIIFCjCCAvICCQDEfOyF4ZtyMzANBgkqhkiG9w0BAQsFADBHMQswCQYDVQQGEwJV" +
            "UzELMAkGA1UECAwCSUwxETAPBgNVBAcMCEV2YW5zdG9uMRgwFgYDVQQKDA9BaGFu" +
            "YVBlZGlhdHJpY3MwHhcNMTgxMDAyMjEzOTQxWhcNMTgxMTAxMjEzOTQxWjBHMQsw" +
            "CQYDVQQGEwJVUzELMAkGA1UECAwCSUwxETAPBgNVBAcMCEV2YW5zdG9uMRgwFgYD" +
            "VQQKDA9BaGFuYVBlZGlhdHJpY3MwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK" +
            "AoICAQDcAYnh459lXyCQogqj9nUNR9dyz11w694hEA/CD/dkHKC/gCWyXZyq3Cqr" +
            "Qpk2uAbibyalCFIx+TMg6eiPFvjhyzr51xvuYjfZEmc/iBgXQyJhIkEh9s9ejRmt" +
            "RS8R5TxNhMVlZMXOLAIoHlERpOU/dm0+tRZJOGb3hOXzJHwAWc1l1KLsAZKDkeOx" +
            "UPzK7Lx0KSNi8KNff/T8HObPxrmah37D1Eyx+oQC7GpOHeBT/2IMvj1YhRpxHV5j" +
            "IC7sKWxnGk2vW4fBV/zw2NMOF1MdNToEHKpfnCx8X9ySqvilO7csKnnBxxzSNQ/3" +
            "//F9GgIn4shjQLoONZSx1UuEUFRP2330+SSYvj9x+MHw3vKUKyNH5vkfeTGXSHgy" +
            "qvnyqnx2R2gW4i7RoHw+Zro9mbS7u1Hrv7gV40cbGargrHMomxYgoYwvNFrWSkfm" +
            "U+xWebY+YACe2AzQ94wHLKjZJ6q6VMngkP3ueka4qYjFDAZz/3+Ae4Qk149AO6hi" +
            "psnN82AgrES3DO4wtS9s5gJs0Ol8vZWy5NLj8+oHFTNlLI63tb5NhoAlFf6y7+nJ" +
            "mhrshAXoF3uzTe2un511N1slLtaQu1t5Aplvik7l4nm96vHzFeNKCx2vqeAbYfaQ" +
            "hNHodJAiCoN5EkBC+9tfaqYukTd8BfTy3AXaExrjw+k99VNoLwIDAQABMA0GCSqG" +
            "SIb3DQEBCwUAA4ICAQCZ9cgwCyACsjE2vFtGwOhqRRxpQB96ACcW4Z5jeTMEw04H" +
            "QeOzTuF9kyZez9aG+gzALuYbynuoUw+zAhnmPsi45nmGQ7BL/kDsQP8c10D+l5zL" +
            "N/VsPZMMO5Bhzhm236KrPgnbC+0pYqqpKFVqWcmWC39jaorHuBZNo8VGBTmhXdci" +
            "MBWx0jdoGZ6B0YO0Uht7lTDHFK79u4P6EKRZzinjWo2rX9piXj8UWDzq2ZC8Xjdq" +
            "2MPxOAjIXSlS98jugO4RbLFAikLwLUUbupoXfcksho1VtfD795DUeLVApMi0suHR" +
            "kn1uiFDwQnE1lFg/M49HL+D/xIxHlPXgJxEt/6FR6rJoNSE3tW8tE+8lTP77VrlK" +
            "IGAm+OGRoUmyIlqRcVxHXoqeqrfzGPRB9PgK0V5EueSoavP8QfQuT94zYy1E8Y4X" +
            "W5ruePpOuC3L5fAEcdJUkPOWsQ0vHZJvpkzFLEJcmA1TnINxuC49qxALMNjoYdfr" +
            "2I4wJoB+xn5lB0/IjVIFu+9+/ExYSxGqBQ+0ejIrnxgHlaxNWpyMVvOQ6e+WRJm3" +
            "3NWISoCBtqNz4vwg9r74a+ZPQH6oeb6pRYFl4GYUaZ1hPk0SopNWEpU2exE1PpxJ" +
            "xY+VLL51HDvZqNIThRd7U/djufWiFzEZZjN+uF1jam51niNrwS17tg0H1z+QMg=="
          ],
          "n": "p_xUHnNOGXJoiA6kRESMglb1l3X484vCfAnOi7Ia9Gi9VHEMy9f4lWvsh-Ak3W_jhCA9WbxQN8ETvDtvpPYdmpBhgczsPwzdrlKRGthTfaQDlZSa6a4g-JQmH-xu6l8kp5ksgpz5C3ZmY1hXADDMLIkDhpApnFK9Tdgdv-UZxrUp9Ij3lGttjStQORYhhQAQwBVmj0qtgc4rjRJP7ENjLUmXbaYgSAVXCoIzcfPy-f6OoQjPQDHHcmFXdFbw8AL3mQ5Q6E5vRZkG5_qU7FQaRckW711WHuJSyjZWGBh1oosVv7UpvokFbuOmlXrcvARqx5amm6rBQaVdqY5f40p6Cw",
          "e": "AQAB",
          "kid": "test_kid_bad_key",
          "x5t": "test_kid_bad_key"
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

