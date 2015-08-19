# Hapi Auth for Android

Android ID Token authentication scheme for [**hapi**](https://github.com/hapijs/hapi).

This project was forked from the [hapi-auth-bearer-token](https://github.com/johnbrett/hapi-auth-bearer-token) plugin to match this specific use case. It is actively maintained and has 100% unit test coverage. If you have any problems using it or have any feature requests, please raise an issue. **Don't use it in production, it's not bulletproof yet.**


## Install

Not quite there yet.


## Documentation

As the [Google Sign-in for Android documentation page](https://developers.google.com/identity/sign-in/android/backend-auth) states:

> If you use Google Sign-In with an app or site that communicates with a backend server, you might need to identify the currently signed-in user on the server. To do so securely, after a user successfully signs in, send the user's ID token to your server using HTTPS. Then, on the server, verify the integrity of the ID token and retrieve the user's ID from the sub claim of the ID token. You can use user IDs transmitted in this way to safely identity the currently signed-in user on the backend.

That's what this plugin does for you! Bearer authentication requires validating an ID Token passed in by either the `bearer` authorization header, or by an `access_token` query parameter. The `'android-id-token'` scheme takes the following options:

- `validateFunc` _(Required)_ - a validation function with the signature `function(token, payload, callback)` where:
    - `token` - the ID Token received from the client.
    - `payload` - the ID Token payload
    - `callback` - a callback function with the signature `function(err, isValid, credentials)` where:
        - `err` - an internal error.
        - `isValid` - `true` if both the username was found and the password matched, otherwise `false`.
        - `credentials` - a credentials object passed back to the application in `request.auth.credentials`. Typically, `credentials` are only
          included when `isValid` is `true`, but there are cases when the application needs to know who tried to authenticate even when it fails
          (e.g. with authentication mode `'try'`).
- `options` _(Required)_
    - `oauth2` _(Required)_
        - `clientId` _(Required)_ - The client ID for your back-end.
    - `accessTokenName` _(Optional; Default: 'access_token')_ - Rename the token query parameter key e.g. 'sample_token_name' would rename the token query parameter to /route1?sample_token_name=12345678.
    - `allowQueryToken` _(Optional; Default: true)_ - Disable accepting token by query parameter, forcing token to be passed in through authorization header.
    - `allowMultipleHeaders` _(Optional; Default: false)_ - Allow multiple authorization headers in request, e.g. `Authorization: FD AF6C74D1-BBB2-4171-8EE3-7BE9356EB018; Bearer 12345678`
    - `tokenType` _(Optional; Default: 'Bearer')_ - Allow custom token type, e.g. `Authorization: Basic 12345678`

For convenience, the `request` object can be accessed from `this` within `validateFunc`. This allows some greater flexibility with authentication, such different authentication checks for different routes.

The received ID Token must be issued by an Android device through the `GoogleAuthUtil#getToken()` method. This Token is actually a JSON Web Token (JWT) and contains a JSON payload (second parameter passed to `validateFunc`) with the following structure:
```JSON
{
    "iss": "https://accounts.google.com",
    "sub": "110169484474386276334",
    "azp": "1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com",
    "email": "billd1600@gmail.com",
    "at_hash": "X_B3Z3Fi4udZ2mf75RWo3w",
    "email_verified": "true",
    "aud": "1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com",
    "iat": "1433978353",
    "exp": "1433981953"
}
```

Where `sub` is the user's unique Google ID, `email`'s the user's mail, `azp` (stands for "authorized party") is your Android app client ID and `aud` is your back-end app client ID.

If you're still confused, read this:
+ [Verifying back-end calls from Android](http://android-developers.blogspot.pt/2013/01/verifying-back-end-calls-from-android.html)
+ [Google Sign-in for Android](https://developers.google.com/identity/sign-in/android/backend-auth)


## Example 

```javascript
var Hapi = require('hapi');

var server = new Hapi.Server();
server.connection({ port: 8080 });

server.register(require('hapi-auth-android'), function (err) {

    server.auth.strategy('example', 'android-id-token', {
        allowQueryToken: true,              // optional, true by default
        allowMultipleHeaders: false,        // optional, false by default
        accessTokenName: 'access_token',    // optional, 'access_token' by default
        oauth2: {
            clientId: '<YOUR-BACK-END-CLIENT-ID>'
        },
        validateFunc: function(token, payload, callback) {

            // For convenience, the request object can be accessed
            // from `this` within validateFunc.
            var request = this;  

            // Use a real strategy here,
            // comparing with a token from your database for example
            if(token === "1234"){
                return callback(null, true, { token: token, email: payload.email });
            }
            return callback(null, false);
        }
    });
    
    server.route({
        method: 'GET',
        path: '/',
        handler: function (request, reply) {
            reply('success');
        },
        config: { auth: 'example' }
    });
});

server.start(function () {
    console.log('Server started at: ' + server.info.uri);
})
```


## Licence
This library is licensed under [MIT](https://github.com/andrezzoid/hapi-auth-android/blob/master/LICENSE).