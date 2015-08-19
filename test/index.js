var Boom = require('boom');
var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');
var OAuth2Client = require('google-auth-library/lib/auth/oauth2client');
var Sinon = require('sinon');



// Test shortcuts

var lab = exports.lab = Lab.script();
var expect = Code.expect;
var before = lab.before;
var after = lab.after;
var describe = lab.describe;
var it = lab.it;


// Declare internals

var internals = {};

internals.defaultHandler = function (request, reply) {

    reply('success');
};


internals.defaultValidateFunc = function (token, payload, callback) {

    return callback(null, token === '12345678',  { token: token });
};


internals.alwaysRejectValidateFunc = function (token, payload, callback) {

    return callback(null, false, { token: token });
};


internals.alwaysErrorValidateFunc = function (token, payload, callback) {

    return callback({ Error:'Error' }, false, null);
};


internals.boomErrorValidateFunc = function (token, payload, callback) {

    return callback(Boom.badImplementation('test info'), false, null);
};


internals.noCredentialValidateFunc = function (token, payload, callback) {

    return callback(null, true, null);
};


// Create Server

internals.server = new Hapi.Server({ debug: false });
internals.server.connection();


before(function (done){


    // Stub OAuth2Client#verifyIdToken so it only verifies the audience

    internals.stubOAuth2Client = Sinon.stub(OAuth2Client.prototype, 'verifyIdToken', function (idToken, audience, callback) {

        var payload = {
            'iss': 'https://accounts.google.com',
            'sub': '110169484474386276334',
            'azp': '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com',
            'email': 'billd1600@gmail.com',
            'at_hash': 'X_B3Z3Fi4udZ2mf75RWo3w',
            'email_verified': 'true',
            'aud': '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com',
            'iat': '1433978353',
            'exp': '1433981953'
        };

        if (audience !== payload.aud) {
            return callback(new Error('Wrong recipient, payload audience != clientId'));
        }
        return callback(null, {
            getPayload: function () {

                return payload;
            }
        });

    });


    // Register hapi-auth-android and set strategies

    internals.server.register(require('../'), function (err) {

        expect(err).to.not.exist();

        internals.server.auth.strategy('default', 'android-id-token', true, {
            validateFunc: internals.defaultValidateFunc,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('default_named_access_token', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            accessTokenName: 'my_access_token',
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('always_reject', 'android-id-token', {
            validateFunc: internals.alwaysRejectValidateFunc,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('with_error_strategy', 'android-id-token', {
            validateFunc: internals.alwaysErrorValidateFunc,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('boom_error_strategy', 'android-id-token', {
            validateFunc: internals.boomErrorValidateFunc,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('no_credentials', 'android-id-token', {
            validateFunc: internals.noCredentialValidateFunc,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('query_token_enabled', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            allowQueryToken: true,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('query_token_disabled', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            allowQueryToken: false,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('multiple_headers', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            allowMultipleHeaders: true,
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('custom_token_type', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            tokenType: 'Basic',
            oauth2: { clientId: '1008719970978-hb24n2dstb40o45d4feuo2ukqmcc6381.apps.googleusercontent.com' }
        });

        internals.server.auth.strategy('audience_dont_match', 'android-id-token', {
            validateFunc: internals.defaultValidateFunc,
            oauth2: { clientId: '9414861317621.apps.googleusercontent.com' }
        });

        internals.server.route([
            { method: 'POST', path: '/basic', handler: internals.defaultHandler, config: { auth: 'default' } },
            { method: 'POST', path: '/basic_default_auth', handler: internals.defaultHandler, config: { } },
            { method: 'GET', path: '/basic_named_token', handler: internals.defaultHandler, config: { auth: 'default_named_access_token' } },
            { method: 'GET', path: '/basic_validate_error', handler: internals.defaultHandler, config: { auth: 'with_error_strategy' } },
            { method: 'GET', path: '/boom_validate_error', handler: internals.defaultHandler, config: { auth: 'boom_error_strategy' } },
            { method: 'GET', path: '/always_reject', handler: internals.defaultHandler, config: { auth: 'always_reject' } },
            { method: 'GET', path: '/no_credentials', handler: internals.defaultHandler, config: { auth: 'no_credentials' } },
            { method: 'GET', path: '/query_token_disabled', handler: internals.defaultHandler, config: { auth: 'query_token_disabled' } },
            { method: 'GET', path: '/query_token_enabled', handler: internals.defaultHandler, config: { auth: 'query_token_enabled' } },
            { method: 'GET', path: '/multiple_headers_enabled', handler: internals.defaultHandler, config: { auth: 'multiple_headers' } },
            { method: 'GET', path: '/custom_token_type', handler: internals.defaultHandler, config: { auth: 'custom_token_type' } },
            { method: 'GET', path: '/audience_dont_match', handler: internals.defaultHandler, config: { auth: 'audience_dont_match' } }
        ]);

        done();
    });
});


after(function (done) {

    internals.server = null;
    internals.stubOAuth2Client.restore();
    done();
});


it('returns 200 and success with correct bearer token header set', function (done) {

    var request = { method: 'POST', url: '/basic', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('returns 200 and success with correct bearer token header set in multiple authorization header', function (done) {

    var request = { method: 'GET', url: '/multiple_headers_enabled', headers: { authorization: 'Bearer 12345678; FD AF6C74D1-BBB2-4171-8EE3-7BE9356EB018' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('returns 200 and success with correct bearer token header set in multiple places of the authorization header', function (done) {

    var request = { method: 'GET', url: '/multiple_headers_enabled', headers: { authorization: 'FD AF6C74D1-BBB2-4171-8EE3-7BE9356EB018; Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('returns 200 and success with correct bearer token query param set', function (done) {

    var request = { method: 'POST', url: '/basic?access_token=12345678' };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('returns 401 error when no bearer token is set when one is required by default', function (done) {

    var request = { method: 'POST', url: '/basic_default_auth' };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('returns 401 when bearer authorization header is not set', function (done) {

    var request = { method: 'POST', url: '/basic', headers: { authorization: 'definitelynotacorrecttoken' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('returns 401 error with bearer token type of object (invalid token)', function (done) {

    var request = { method: 'POST', url: '/basic', headers: { authorization: 'Bearer {test: 1}' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('returns 500 when strategy returns a regular object to validateFunc', function (done) {

    var request = { method: 'GET', url: '/basic_validate_error', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(JSON.stringify(res.result)).to.equal('{\"Error\":\"Error\"}');
        done();
    });
});


it('returns 500 when strategy returns a Boom error to validateFunc', function (done) {

    var request = { method: 'GET', url: '/boom_validate_error', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(500);
        expect(JSON.stringify(res.result)).to.equal('{\"statusCode\":500,\"error\":\"Internal Server Error\",\"message\":\"An internal server error occurred\"}');
        done();
    });
});


it('returns 401 handles when isValid false passed to validateFunc', function (done) {

    var request = { method: 'GET', url: '/always_reject', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('returns 500 when no credentials passed to validateFunc', function (done) {

    var request = { method: 'GET', url: '/no_credentials', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(500);
        done();
    });
});


it('returns a 200 on successful auth with access_token query param renamed and set', function (done) {

    var requestQueryToken = { method: 'GET', url: '/basic_named_token?my_access_token=12345678' };
    internals.server.inject(requestQueryToken, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('doesn\'t affect header auth and will return 200 and success when specifying custom access_token name', function (done) {

    var requestQueryToken = { method: 'GET', url: '/basic_named_token', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(requestQueryToken, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('allows you to enable auth by query token', function (done) {

    var requestQueryToken = { method: 'GET', url: '/query_token_enabled?access_token=12345678' };
    internals.server.inject(requestQueryToken, function (res) {

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal('success');
        done();
    });
});


it('allows you to disable auth by query token', function (done) {

    var requestHeaderToken  = { method: 'GET', url: '/query_token_disabled?access_token=12345678' };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('disables multiple auth headers by default', function (done) {

    var request = { method: 'POST', url: '/basic', headers: { authorization: 'RandomAuthHeader 1234; Bearer 12345678' } };
    internals.server.inject(request, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});

it('allows you to enable multiple auth headers', function (done) {

    var requestHeaderToken = { method: 'GET', url: '/multiple_headers_enabled', headers: { authorization: 'RandomAuthHeader 1234; Bearer 12345678' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(200);
        done();
    });
});


it('return unauthorized when no auth info and multiple headers disabled', function (done) {

    var requestHeaderToken = { method: 'POST', url: '/basic', headers: { authorization: 'x' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('return unauthorized when no auth info and multiple headers enabled', function (done) {

    var requestHeaderToken = { method: 'GET', url: '/multiple_headers_enabled', headers: { authorization: 'x' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('return unauthorized when different token type is used', function (done) {

    var requestHeaderToken = { method: 'GET', url: '/custom_token_type', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});


it('return 200 when correct token type is used', function (done) {

    var requestHeaderToken  = { method: 'GET', url: '/custom_token_type', headers: { authorization: 'Basic 12345678' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(200);
        done();
    });
});


it('return 401 when payload audience is different from required audience', function (done) {

    var requestHeaderToken  = { method: 'GET', url: '/audience_dont_match', headers: { authorization: 'Bearer 12345678' } };
    internals.server.inject(requestHeaderToken, function (res) {

        expect(res.statusCode).to.equal(401);
        done();
    });
});
