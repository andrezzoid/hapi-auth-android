var Boom = require('boom');
var Hoek = require('hoek');
var OAuth2Client = require('google-auth-library/lib/auth/oauth2client');


// Declare Internals

var internals = {};


exports.register = function (server, options, next) {

    server.auth.scheme('android-id-token', internals.implementation);
    next();
};

exports.register.attributes = {
    pkg: require('../package.json')
};


internals.implementation = function (server, options) {

    Hoek.assert(options, 'Missing bearer auth strategy options');
    Hoek.assert(typeof options.validateFunc === 'function', 'options.validateFunc must be a valid function in bearer scheme');
    Hoek.assert(options.oauth2, 'Missing options.oauth2 object');
    Hoek.assert(options.oauth2.clientId, 'Missing options.oauth2.clientId property');

    options.accessTokenName = options.accessTokenName || 'access_token';
    options.allowQueryToken = options.allowQueryToken === false ? false : true;
    options.allowMultipleHeaders = options.allowMultipleHeaders === true ? true : false;
    options.tokenType = options.tokenType || 'Bearer';

    var settings = Hoek.clone(options);

    var scheme = {
        authenticate: function (request, reply) {

            var req = request.raw.req;
            var authorization = req.headers.authorization;

            if (settings.allowQueryToken
                && !authorization
                && request.query[settings.accessTokenName] ) {
                authorization = options.tokenType + ' ' + request.query[settings.accessTokenName];
                delete request.query[settings.accessTokenName];
            }

            if (!authorization) {
                return reply(Boom.unauthorized(null, options.tokenType));
            }

            if (settings.allowMultipleHeaders) {
                var headers = authorization.match(/Bearer\s+([^;$]+)/i);
                if (headers !== null) {
                    authorization = headers[0];
                }
            }

            var parts = authorization.split(/\s+/);

            if (parts[0].toLowerCase() !== options.tokenType.toLowerCase()) {
                return reply(Boom.unauthorized(null, options.tokenType));
            }

            var token = parts[1];


            // Verify Android ID Token

            var client = new OAuth2Client(settings.oauth2.clientId, null, null, null);
            client.verifyIdToken(token, settings.oauth2.clientId, function (err, login) {

                if (err) {
                    return reply(Boom.unauthorized('Failed to verify ID Token', options.tokenType));
                }


                // Call validateFunc() with the original ID token and the token payload

                settings.validateFunc.call(request, token, login.getPayload(), function (err, isValid, credentials) {

                    if (err) {
                        return reply(err, { credentials: credentials, log: { tags: ['auth', 'bearer'], data: err } });
                    }

                    if (!isValid) {
                        return reply(Boom.unauthorized('Bad token', options.tokenType), { credentials: credentials });
                    }

                    if (!credentials
                        || typeof credentials !== 'object') {
                        return reply(Boom.badImplementation('Bad token string received for Bearer auth validation'), { log: { tags: 'token' } });
                    }

                    return reply.continue({ credentials: credentials });
                });
            });
        }
    };

    return scheme;
};
