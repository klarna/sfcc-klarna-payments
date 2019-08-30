var assert = require('chai').assert;
var request = require('request');
var config = require('../it.config');
var chai = require('chai');


describe('Klarna Payments', function () {
    this.timeout(10000);

    request = request.defaults({
        baseUrl: config.baseUrl,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        rejectUnauthorized: false,
        jar: true,
        json: true
    });

    var SaveAuthRequest = {
        method: 'GET',
        uri: 'KlarnaPayments-SaveAuth',
		headers: {
			'X-Auth': 'ITESTKEY1234',
			'Finalize-Required': 'true'
		},
    };
    var LoadAuthRequest = {
        method: 'GET',
        uri: 'KlarnaPayments-LoadAuth',
    };

	
    it('should save authorization', function (done) {
        request(SaveAuthRequest, function (error, response, jsonResponse) {
            if (error) done(error);
            assert.equal(response.statusCode, 200, 'Unexpected statusCode');
            done();
        });
    });
	
    it('should load save authorization', function (done) {
        request(LoadAuthRequest, function (error, response, jsonResponse) {
            if (error) done(error);
            assert.equal(response.statusCode, 200, 'Unexpected statusCode');
            assert.equal(jsonResponse.FinalizeRequired, 'true');
            done();
        });
    });
	
	

});
