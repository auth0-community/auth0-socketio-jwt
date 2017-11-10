function InvalidTokenError (code, error) {
  Error.call(this, error.message);
  this.message = error.message;
  this.inner = error;
  this.data = {
    message: this.message,
    code: code,
    type: "InvalidTokenError"
  };
}

InvalidTokenError.prototype = Object.create(Error.prototype);
InvalidTokenError.prototype.constructor = InvalidTokenError;

module.exports = InvalidTokenError;