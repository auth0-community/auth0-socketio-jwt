/**
 * This module allows to authenticate socket.io connections with JWTs.
 * This is especially if you do not want to use cookies in a single page application.
 */

/// <reference types='socket.io' />

import { Secret, GetPublicKeyOrSecret } from 'jsonwebtoken';

declare module '@ssnxd/socketio-jwt' {
  /**
   * Defines possible errors for the secret-callback.
   */
  interface ISocketIOError {
    readonly code: string;
    readonly message: string;
  }

  /**
   * Callback gets called, if secret (success param) is given dynamically.
   * secret will be passed as 'secretOrPublicKey'
   * jsonwebtoken.verify(
   *  token: string,
   *  secretOrPublicKey: Secret | GetPublicKeyOrSecret,
   *  options?: VerifyOptions,  callback?: VerifyCallback
   * )
  **/
  interface ISocketCallback {
    (err: ISocketIOError, success?: Secret | GetPublicKeyOrSecret): void;
  }

  interface ISocketIOMiddleware {
    (socket: SocketIO.Socket, fn: (err?: any) => void): void;
  }

  interface IOptions {
    additional_auth?: (
      decoded: object,
      onSuccess: () => void,
      onError: (err: string | ISocketIOError, code: string) => void
    ) => void;
    customDecoded?: (decoded: object) => object;

    callback?: false | number;
    secret:
      // Sync
      | string
      // Async without header (method arity 3)
      | ((
        request: any,
        decodedToken: object,
        callback: ISocketCallback
      ) => void)
      // Async with header (method arity 4)
      | ((
        request: any,
        headers: any,
        decodedToken: object,
        callback: ISocketCallback
      ) => void);

    encodedPropertyName?: string;
    decodedPropertyName?: string;
    auth_header_required?: boolean;
    handshake?: boolean;
    required?: boolean;
    timeout?: number;
    cookie?: string;
  }

  function authorize(
    options: IOptions /*, onConnection: Function*/
  ): ISocketIOMiddleware;

  interface UnauthorizedError extends Error {
    readonly message: string;
    readonly inner: object;
    readonly data: { message: string; code: string; type: 'UnauthorizedError' };
  }

  var UnauthorizedError: {
    prototype: UnauthorizedError;
    new(code: string, error: { message: string }): UnauthorizedError;
  };

  /**
   * This is an augmented version of the SocketIO.Server.
   * It knows the 'authenticated' event and should be extended in future.
   * @see SocketIO.Server
   */
  export interface JWTServer extends SocketIO.Server {
    /**
     * The event gets fired when a new connection is authenticated via JWT.
     * @param event The event being fired: 'authenticated'
     * @param listener A listener that should take one parameter of type Socket
     * @return The default '/' Namespace
     */
    on(
      event: 'authenticated' | string,
      listener: (socket: SocketIO.Socket) => void
    ): SocketIO.Namespace;
  }
}
