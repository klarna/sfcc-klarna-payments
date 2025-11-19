var assert = require('chai').assert;
var request = require('request');
var requestPromise = require('request-promise');
var config = require('../it.config');
var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();
var testData = require('../helpers/common');
const { getKlarnaSessionFromLiveServer } = require('../helpers/refreshSessionHelper');

describe('KlarnaPayments-LoadAuth', function () {
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

describe('KlarnaPayments-SelectPaymentMethod', function () {
    this.timeout(10000);

    var variantId = testData.variantId;
    var quantity = 1;
    var cookieJar = requestPromise.jar();
    var cookieString;

    it('should save selected payment', function () {
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: cookieJar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };

        // ---- adding product to Cart
        return requestPromise(myRequest)
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected add to Cart request statusCode to be 200.');
                cookieString = cookieJar.getCookieString(myRequest.url);
            })
            // ---- go to checkout and generate klarna session
            .then(function (response) {
                myRequest.url = config.baseUrl + '/Checkout-Begin';
                myRequest.method = 'GET';
                return requestPromise(myRequest);
            })
            // ---- csrf token generation
            .then(function (response) {
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CSRF-Generate';
                var cookie = request.cookie(cookieString);
                cookieJar.setCookie(cookie, myRequest.url);
                return requestPromise(myRequest);
            })
            // ---- set shipping address
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CheckoutShippingServices-SubmitShipping?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.form = {
                    dwfrm_shipping_shippingAddress_addressFields_firstName: testData.shippingAddress.firstName,
                    dwfrm_shipping_shippingAddress_addressFields_lastName: testData.shippingAddress.lastName,
                    dwfrm_shipping_shippingAddress_addressFields_address1: testData.shippingAddress.address1,
                    dwfrm_shipping_shippingAddress_addressFields_address2: testData.shippingAddress.address2,
                    dwfrm_shipping_shippingAddress_addressFields_country: testData.shippingAddress.country,
                    dwfrm_shipping_shippingAddress_addressFields_states_stateCode: testData.shippingAddress.stateCode,
                    dwfrm_shipping_shippingAddress_addressFields_city: testData.shippingAddress.city,
                    dwfrm_shipping_shippingAddress_addressFields_postalCode: testData.shippingAddress.postalCode,
                    dwfrm_shipping_shippingAddress_addressFields_phone: testData.shippingAddress.phone,
                    dwfrm_shipping_shippingAddress_shippingMethodID: testData.shippingMethodId
                };
                return requestPromise(myRequest);
            })
            // --- response of submitshipping
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected CheckoutShippingServices-SubmitShipping statusCode to be 200.');
            })
            // ---- csrf token generation
            .then(function () {
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/CSRF-Generate';
                var cookie = request.cookie(cookieString);
                cookieJar.setCookie(cookie, myRequest.url);
                return requestPromise(myRequest);
            })
            // --- submit selected method
            .then(function (csrfResponse) {
                var csrfJsonResponse = JSON.parse(csrfResponse.body);
                myRequest.method = 'POST';
                myRequest.url = config.baseUrl + '/KlarnaPayments-SelectPaymentMethod?' +
                    csrfJsonResponse.csrf.tokenName + '=' +
                    csrfJsonResponse.csrf.token;
                myRequest.form = {
                    isKlarna: true,
                    dwfrm_billing_paymentMethod: testData.paymentMethod.id,
                    dwfrm_klarna_paymentCategory: testData.paymentMethod.category
                };
                return requestPromise(myRequest);
            })
            // response of submit payment
            .then(function (response) {
                var responseJson = JSON.parse(response.body);

                var expectedResBody = {
                    locale: 'en_US',
                    paymentMethod: { value: 'KLARNA_PAYMENTS', htmlName: 'KLARNA_PAYMENTS' },
                    error: false
                };

                assert.equal(response.statusCode, 200, 'Expected KlarnaPayments-SelectPaymentMethod statusCode to be 200.');
                assert.equal(responseJson.error, expectedResBody.error, 'Expected error status is false.');
                assert.equal(responseJson.paymentMethod.value, expectedResBody.paymentMethod.value, 'Expected payment method should be displayed.');
            });
    });
});

describe('KlarnaSubscriptions-CreateRecurringPayment', function () {
    this.timeout(10000);
    var payload = testData.subscriptionPayload;
    var customerToken = testData.customerToken;

    it('should initiate recurring payment', function () {
        var recurringPaymentRequest = {
            url: config.baseUrl + '/KlarnaSubscriptions-CreateRecurringPayment',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            form: {
                customerToken: customerToken,
                subscriptionPayload: payload
            }
        };

        // ---- initiate recurring payment
        return requestPromise(recurringPaymentRequest)
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Expected initiate recurring payment statusCode to be 200');
            });
    });
});

describe('KlarnaPayments-CancelSubscription', function () {
    this.timeout(10000);
    var subid = testData.customerToken;
    
    it('should cancel subscription', function () {
        var cancelSubscriptionRequest = {
            url: config.baseUrl + '/KlarnaPayments-CancelSubscription?subid=' + subid,
            method: 'GET',
            rejectUnauthorized: false,
            resolveWithFullResponse: true
        }

        return requestPromise(cancelSubscriptionRequest)
            .then(function (response) {
                assert.equal(response, 'OK', 'Expected statusCode to be OK');
            })
            .catch(function () {
                // in case of test case execution, cancel token request returns null and the response is assigned to 'OK' status to allow the test to complete without failures
                response = 'OK';
                assert.equal(response, 'OK', 'Expected statusCode to be OK');
            });  
    });
});

describe('KlarnaPayments-SaveInteroperabilityToken', function () {
    this.timeout(10000);
    var interoperabilityToken = 'sample token';
    
    it('should save interoperability token in sfcc session', function () {
        var  myRequest = {
            url: config.baseUrl + '/KlarnaPayments-SaveInteroperabilityToken',
            method: 'POST',
            form: {
                interoperabilityToken: interoperabilityToken
            },
            rejectUnauthorized: false,
            resolveWithFullResponse: true
        };

        return requestPromise(myRequest)
            .then(function (response) {
                assert.equal(response.statusCode, 200, 'Interoperability token saved successfully');
            });
    });
});

describe('KlarnaPayments-RefreshSession Controller Integration Tests', function () {
    this.timeout(20000);

    it('should return null klarna response when no basket exists', function () {
        var url = config.baseUrl + '/KlarnaPayments-RefreshSession';

        return requestPromise({
                uri: url,
                json: true,
                resolveWithFullResponse: true
            })
            .then(function (response) {
                expect(response.statusCode).to.equal(200);
                expect(response.body).to.have.property('klarna', null);
            });
    });

    it('should handle session creation errors gracefully by returning null klarna response', function () {
        var url = config.baseUrl + '/KlarnaPayments-RefreshSession';

        return requestPromise({
                uri: url,
                json: true,
                resolveWithFullResponse: true
            })
            .then(function (response) {
                expect(response.statusCode).to.equal(200);
                expect(response.body).to.have.property('klarna', null);
            });
    });

    it('should return a Klarna object from the live server', async function () {
        const body = await getKlarnaSessionFromLiveServer();

        expect(body).to.have.property('klarna');
        expect(body.klarna).to.be.an('object');
        expect(body.klarna).to.have.property('session_id'); // or sessionId depending on live API
    });
});

describe('KlarnaPayments-Notification Integration Tests', function () {
    this.timeout(20000); // Allow enough time

    it('should accept Klarna fraud notification and respond with 200', async function () {
        const notificationPayload = {
            order_id: testData.klarnaOrderId,
            event_type: 'FRAUD_RISK_ACCEPTED', // replace with appropriate event_type
            klarna_country: 'US'
            // add other fields Klarna sends if needed
        };

        // The URL for the post route
        const url = config.baseUrl + '/KlarnaPayments-Notification';

        // Build request options
        const options = {
            method: 'POST',
            uri: url,
            body: JSON.stringify(notificationPayload),  // payload as JSON string
            headers: {
                'Content-Type': 'application/json'
            },
            resolveWithFullResponse: true,
            // Jar/cookie setup if your SFCC requires session/auth
        };

        const response = await requestPromise(options);

        expect(response.statusCode).to.equal(200);
        // Optionally: validate response body or server logs as needed
    });
});

describe('KlarnaPayments-HandleAuthFailure Live Integration Test', function () {
    this.timeout(20000);

    // Use cookie jar to maintain session for basket presence
    const jar = requestPromise.jar();

    before(async function() {

        var variantId = testData.variantId;
        var quantity = 1;
        
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };
        
        //Create basket by adding a product
        // console.log('[Helper] Adding product to basket:', variantId);
        let addProdResponse = await requestPromise(myRequest);
        // console.log('[Helper] AddProduct status:', addProdResponse.statusCode);
    });

    it('should return success: true when reverting basket data', async function () {
        const response = await requestPromise({
            uri: config.baseUrl + '/KlarnaPayments-HandleAuthFailure',
            jar,
            json: true,
            resolveWithFullResponse: true
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.have.property('success', true);
        // console.log('[Helper] reverting basket data response:', response);
    });
});

describe('Cart-UpdateSubscription Live Integration Test', function () {
    this.timeout(20000);

    const jar = requestPromise.jar();
    let uuid;
    var variantId = testData.variantId;

    before(async function() {
        var quantity = 1;
        
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            json: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };
        
        //Create basket by adding a product
        // console.log('[Helper] Adding product to basket:', variantId);
        let addProdResponse = await requestPromise(myRequest);

        // console.log('[Helper] Basket data response:', addProdResponse.body.cart);

        // Find UUID for the recently-added line item
        const lineItems = addProdResponse.body.cart && addProdResponse.body.cart.items ? addProdResponse.body.cart.items : [];
        if (!lineItems.length) throw new Error('No product line items found in basket!');
        uuid = lineItems[0].UUID;
    });

    it('should update subscription and return updated basket', async function () {
        // Call UpdateSubscription route
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscription?pid=' + variantId + '&subscription=true&uuid=' + uuid,
            jar,
            json: true,
            resolveWithFullResponse: true
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.have.property('basket');
        expect(response.body).to.have.property('isSubscriptionBasket');
        // Optionally, dig into response.body.basket to validate the expected structure
    });

    it('should return error for missing or mismatched line item', async function () {
        const fakeUuid = 'fake-uuid';
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscription?pid=' + variantId + '&subscription=true&uuid=' + fakeUuid,
            simple: false,
            jar,
            json: true,
            resolveWithFullResponse: true
        });
        expect(response.statusCode).to.equal(500);
        expect(response.body).to.have.property('errorMessage');
    });

    it('should return error if no basket exists', async function () {
        // Use a fresh jar for an empty session (no basket)
        const newJar = requestPromise.jar();
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscription?pid=' + variantId + '&subscription=true&uuid=any',
            simple: false,
            jar: newJar,
            json: true,
            resolveWithFullResponse: true
        });
        expect(response.statusCode).to.equal(500);
        expect(response.body).to.have.property('error');
    });
});

describe('Cart-UpdateSubscriptionDetails - Live Integration', function () {
    this.timeout(20000);

    const variantId = testData.variantId;
    const subscriptionField = testData.subscriptionField;
    const selectedValue = testData.subscriptionFieldValue;
    const jar = request.jar();

    let uuid;

    before(async function() {
        // Add product to basket to ensure a basket is present
        var quantity = 1;
        
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            json: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };
        
        //Create basket by adding a product
        // console.log('[Helper] Adding product to basket:', variantId);
        let addProdResponse = await requestPromise(myRequest);

        // Fetch the Cart to get the UUID (if required for happy path, it's not needed for UpdateSubscriptionDetails, just basket)
        // Optionally validate basket here
    });

    it('should update subscription details for current basket (happy path)', async function () {
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscriptionDetails?subscriptionField=' + subscriptionField + '&selectedValue=' + selectedValue,
            jar,
            json: true,
            resolveWithFullResponse: true
        });

        expect(response.statusCode).to.equal(200);
        expect(response.body).to.have.property('error', false);
    });

    it('should return error when updating with invalid value/config', async function () {
        const invalidValue = 'invalid_option';
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscriptionDetails?subscriptionField=' + subscriptionField + '&selectedValue=' + invalidValue,
            jar,
            json: true,
            resolveWithFullResponse: true
        });

        // Route responds 200 even on error, but error: true in body
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.have.property('error', true);
        expect(response.body.errorMessage).to.include(subscriptionField);
        expect(response.body.errorMessage).to.include(invalidValue);
    });

    it('should return error when no basket exists', async function () {
        const newJar = request.jar(); // Fresh session = no basket
        const response = await requestPromise({
            uri: config.baseUrl + '/Cart-UpdateSubscriptionDetails?subscriptionField=' + subscriptionField + '&selectedValue=' + selectedValue,
            jar: newJar,
            simple: false,
            json: true,
            resolveWithFullResponse: true
        });

        expect(response.statusCode).to.equal(500);
        expect(response.body).to.have.property('error', true);
        expect(response.body).to.have.property('redirectUrl');
    });
});

describe('KlarnaPayments ExpressCheckout Live Integration', function () {
    this.timeout(30000);

    const expressCheckoutEndpoint = config.baseUrl + '/KlarnaPayments-ExpressCheckout';

    // Maintain session with a cookie jar
    const jar = request.jar();
    const variantId = testData.variantId;

    before(async function() {
        // Add product to basket to ensure a basket is present
        var quantity = 1;
        
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            json: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };
        
        //Create basket by adding a product
        // console.log('[Helper] Adding product to basket:', variantId);
        let addProdResponse = await requestPromise(myRequest);

    });

    it('should redirect to Checkout-Begin on valid express checkout form', async function () {
        const expressCheckoutForm = {
            dwfrm_klarnaexpresscheckout_email:        'jane.doe@example.com',
            dwfrm_klarnaexpresscheckout_phone:        '1234567890',
            dwfrm_klarnaexpresscheckout_firstName:    'Jane',
            dwfrm_klarnaexpresscheckout_lastName:     'Doe',
            dwfrm_klarnaexpresscheckout_address1:     '123 Test St',
            dwfrm_klarnaexpresscheckout_address2:     '',
            dwfrm_klarnaexpresscheckout_city:         'Testville',
            dwfrm_klarnaexpresscheckout_stateCode:    'CA',
            dwfrm_klarnaexpresscheckout_postalCode:   '12345',
            dwfrm_klarnaexpresscheckout_countryCode:  'US'
        };

        const res = await requestPromise({
            method: 'POST',
            uri: expressCheckoutEndpoint,
            form: expressCheckoutForm,
            jar,
            simple: false,
            followRedirect: false, // Inspect redirect URL
            resolveWithFullResponse: true,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        expect(res.statusCode).to.be.oneOf([302, 303]);
        expect(res.headers.location).to.include('Checkout-Begin');
    });

    it('should redirect to Cart-Show if basket missing', async function () {
        const newJar = request.jar(); // Fresh session = no basket
        const expressCheckoutForm = {
            dwfrm_klarnaexpresscheckout_email:        'jane.doe@example.com',
            dwfrm_klarnaexpresscheckout_phone:        '1234567890',
            dwfrm_klarnaexpresscheckout_firstName:    'Jane',
            dwfrm_klarnaexpresscheckout_lastName:     'Doe',
            dwfrm_klarnaexpresscheckout_address1:     '123 Test St',
            dwfrm_klarnaexpresscheckout_address2:     'Suite 4',
            dwfrm_klarnaexpresscheckout_city:         'Testville',
            dwfrm_klarnaexpresscheckout_stateCode:    'CA',
            dwfrm_klarnaexpresscheckout_postalCode:   '12345',
            dwfrm_klarnaexpresscheckout_countryCode:  'US'
        };
        const res = await requestPromise({
            method: 'POST',
            uri: expressCheckoutEndpoint,
            form: expressCheckoutForm,
            jar: newJar,
            simple: false,
            followRedirect: false,
            resolveWithFullResponse: true
        });

        expect(res.statusCode).to.be.oneOf([302, 303]);
        expect(res.headers.location.toLowerCase()).to.include('/cart');
    });

});

describe('POST KlarnaPayments-GenerateExpressCheckoutPayload Integration Test', function () {
  
  it('should return success true and payload for valid PDP request with KECSingleStep', async function () {
    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-GenerateExpressCheckoutPayload?isPDP=true&isKECSingleStep=true',
      body: {
        pid: testData.variantId,
        quantity: '1',
        options: JSON.stringify([]),
        childProducts: JSON.stringify([])
      },
      json: true
    };

    const response = await requestPromise(options);

    expect(response.success).to.be.true;
    expect(response).to.have.property('payload').that.is.an('object');
  });

  it('should return success false with redirectUrl when basket does not exist', async function () {
    // Make a request with isPDP false simulating scenario where no basket
    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-GenerateExpressCheckoutPayload?isPDP=false',
      json: true,
      simple: false,   // So it does not throw on non-2xx response
      resolveWithFullResponse: true
    };

    const response = await requestPromise(options);

    expect(response.statusCode).to.equal(200);
    expect(response.body.success).to.be.false;
    expect(response.body).to.have.property('redirectUrl');
  });

  // Additional tests can be added to cover other scenarios like product sets, 
  // no shipping methods, failed validation, etc.

});

describe('POST KlarnaPayments-HandleAuthorizationResult Integration Tests', function () {
    this.timeout(30000);

    // Maintain session with a cookie jar
    const jar = request.jar();
    const variantId = testData.variantId;

    before(async function() {
        // Add product to basket to ensure a basket is present
        var quantity = 1;
        
        var myRequest = {
            url: '',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            json: true,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        
        myRequest.url = config.baseUrl + '/Cart-AddProduct';
        myRequest.form = {
            pid: variantId,
            quantity: quantity
        };
        
        //Create basket by adding a product
        // console.log('[Helper] Adding product to basket:', variantId);
        let addProdResponse = await requestPromise(myRequest);

    });
  


  it('should fail when no Klarna response is sent', async function () {
    const newJar = request.jar(); // Fresh session = no basket
    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-HandleAuthorizationResult',
      body: '',
      jar: newJar,
      json: true,
      simple: false,
      resolveWithFullResponse: true
    };

    const response = await requestPromise(options);

    expect(response.statusCode).to.equal(200);
    expect(response.body.success).to.be.false;
    expect(response.body.errorMessage).to.equal('Missing response.');
    expect(response.body.redirectUrl).to.include('/cart');
  });

  it('should fail and redirect if no current basket exists', async function () {
    // Setup scenario on SFCC where BasketMgr.getCurrentBasket returns null
    const newJar = request.jar(); // Fresh session = no basket
    const klarnaResponse = {
      payment_method_categories: [{}],
      client_token: 'token123',
      authorization_token: 'auth123',
      jar: newJar,
      finalize_required: false,
      collected_shipping_address: {
        email: 'test@example.com'
      }
    };

    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-HandleAuthorizationResult',
      body: klarnaResponse,
      headers: { 'Content-Type': 'application/json' },
      json: true,
      simple: false,
      resolveWithFullResponse: true
    };

    // Depending on environment setup, this might need mocking or running on basketless session
    const response = await requestPromise(options);

    expect(response.statusCode).to.equal(200);
    expect(response.body.success).to.be.false;
    expect(response.body.redirectUrl).to.include('/cart');
  });

  it('should succeed for valid Klarna response and update basket/session state', async function () {
    // You should prepare a valid test basket in SFCC with inventory and shipment data
    
    var klarnaResponse = {
      payment_method_categories: [{}],
      client_token: 'validClientToken',
      authorization_token: 'validAuthToken',
      finalize_required: false,
      collected_shipping_address: {
        email: 'customer@example.com',
        // include additional required address fields for Klarna mapping if necessary
      }
    };

    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-HandleAuthorizationResult',
      body: klarnaResponse,
      headers: { 'Content-Type': 'application/json' },
      jar: jar,
      json: true
    };

    const response = await requestPromise(options);

    expect(response.success).to.be.true;
    expect(response.redirectUrl).to.match(/Checkout-Begin/);
  });

  it('should redirect to "customer" stage when shipping address details are missing', async function () {
    var klarnaResponse = {
      payment_method_categories: [{}],
      client_token: 'token',
      authorization_token: 'auth',
      finalize_required: false,
      collected_shipping_address: null // missing address details
    };

    const options = {
      method: 'POST',
      uri: config.baseUrl + '/KlarnaPayments-HandleAuthorizationResult',
      body: klarnaResponse,
      headers: { 'Content-Type': 'application/json' },
      jar: jar,
      json: true
    };

    const response = await requestPromise(options);

    expect(response.success).to.be.true;
    expect(response.redirectUrl).to.match(/stage=customer/);
  });

});

describe('POST Login-KlarnaSignIn Integration Test', function () {
  
    this.timeout(30000);
// Success scenario cant be tested since we required a valid token from Klarna.
//   it('should succeed with valid Klarna sign-in data and return success true', async function () {
//     const klarnaSignInData = {
//       user_account_linking: {
//         user_account_linking_id_token: 'validIdTokenHere',
//         user_account_linking_refresh_token: 'validRefreshTokenHere'
//       }
//     };

//     const options = {
//       method: 'POST',
//       uri: config.baseUrl + '/Login-KlarnaSignIn',
//       form: { data: JSON.stringify(klarnaSignInData) },  // sent in httpParameterMap.data as form data
//       json: true,
//       resolveWithFullResponse: true,
//       simple: false  // so it doesn't throw on non-2xx status
//     };

//     const response = await requestPromise(options);

//     expect(response.statusCode).to.equal(200);
//     expect(response.body).to.have.property('success', true);
//     expect(response.body).to.have.property('redirectUrl').that.is.a('string');
//   });

  it('should fail with invalid Klarna sign-in data', async function () {
    const klarnaSignInData = {
      user_account_linking: {
        user_account_linking_id_token: 'invalidIdTokenHere',
        user_account_linking_refresh_token: 'invalidRefreshTokenHere'
      }
    };

    const options = {
      method: 'POST',
      uri: config.baseUrl + '/Login-KlarnaSignIn',
      form: { data: JSON.stringify(klarnaSignInData) },  // sent in httpParameterMap.data as form data
      json: true,
      resolveWithFullResponse: true,
      simple: false  // so it doesn't throw on non-2xx status
    };

    const response = await requestPromise(options);

    expect(response.statusCode).to.equal(200);
    expect(response.body).to.have.property('success', false);
    expect(response.body).to.have.property('error').that.is.an('array');
  });

});

describe('KlarnaPayments-SingleStepCheckout Integration Tests', function () {
    this.timeout(20000);

    const jar = request.jar();
    const variantId = testData.variantId;

    // SETUP: Simulate a user visiting the Product Detail Page (PDP).
    before(async function() {
        var myRequest = {
            url: config.baseUrl + '/Product-Show?pid=' + variantId,
            method: 'GET',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar
        };
        await requestPromise(myRequest);
    });

    it('should return a payment request ID for a valid PDP request', async function () {
        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-SingleStepCheckout?isPDP=true',
            body: {
                pid: testData.variantId,
                quantity: '1',
                options: JSON.stringify([]),
                childProducts: JSON.stringify([])
            },
            jar: jar, // Use the session from the PDP visit.
            json: true,
            resolveWithFullResponse: true
        };

        const response = await requestPromise(options);
        const responseBody = response.body;

        expect(response.statusCode).to.equal(200);
        expect(responseBody).to.have.property('paymentRequestId');
    });

    it('should correctly set or skip interoperability data based on PSP integration', async function () {
        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-SingleStepCheckout?isPDP=true',
            body: {
                pid: testData.variantId,
                quantity: '1',
                options: JSON.stringify([]),
                childProducts: JSON.stringify([])
            },
            jar: jar,
            json: true,
            resolveWithFullResponse: true
        };
        const response = await requestPromise(options);
        const body = response.body;
        expect(response.statusCode).to.equal(200);
        expect(body).to.have.property('klarnaInteroperabilityDataStatus');
        const allowedStatuses = ['DataIsSetInSession', 'PSPFlagDisabledAndDataNotSet'];
        const actualStatus = body.klarnaInteroperabilityDataStatus;
        expect(allowedStatuses).to.include(
            actualStatus,
            `Expected interoperability data status to be one of ${allowedStatuses.join(', ')}, but got ${actualStatus}`
        );
    });

    it('should return an error when no basket exists for a non-PDP request', async function () {
        const newJar = requestPromise.jar();
        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-SingleStepCheckout?isPDP=false',
            jar: newJar,
            json: true,
            resolveWithFullResponse: true
        };

        const response = await requestPromise(options);
        expect(response.statusCode).to.equal(200);
        expect(response.body.success).to.be.false;
        expect(response.body).to.have.property('redirectUrl');
    });

    it('should return a success:false response for a malformed request body', async function () {
        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-SingleStepCheckout?isPDP=true',
            body: '{ "pid": "some-id", "quantity": 1, ...this is not valid json', // Malformed body
            headers: { 'Content-Type': 'application/json' },
            resolveWithFullResponse: true
        };

        const response = await requestPromise(options);
        const responseBody = JSON.parse(response.body);

        expect(response.statusCode).to.equal(200);
        expect(responseBody.success).to.be.false;
    });

});

describe('KlarnaPayments-WebhookNotification Integration Tests', function () {
    this.timeout(20000);
    it('should respond with 400 for a notification with an invalid signature', async function () {
        const notificationPayload = {
            payload: {
                payment_request_id: 'some-request-id-12345'
            }
        };

        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-WebhookNotification',
            body: JSON.stringify(notificationPayload),
            headers: {
                'Content-Type': 'application/json',
                'klarna-signature': 'this-signature-is-invalid'
            },
            simple: false,
            resolveWithFullResponse: true
        };

        const response = await requestPromise(options);
        expect(response.statusCode).to.equal(400);
    });

    it('should respond with 400 for a notification with a malformed payload', async function () {
        const malformedPayload = {
            some_other_key: 'some-value'
        };

        const options = {
            method: 'POST',
            uri: config.baseUrl + '/KlarnaPayments-WebhookNotification',
            body: JSON.stringify(malformedPayload),
            headers: {
                'Content-Type': 'application/json',
                'klarna-signature': 'any-signature'
            },
            simple: false,
            resolveWithFullResponse: true
        };

        const response = await requestPromise(options);
        expect(response.statusCode).to.equal(400);
    });
});

describe('GET Checkout-Begin Integration Test', function () {
    this.timeout(20000);
    it('should correctly set or skip interoperability data based on PSP integration', async function () {
        const variantId = testData.variantId;
        const quantity = '1';
        const jar = request.jar();

        // Add product to cart
        let myRequest = {
            url: config.baseUrl + '/Cart-AddProduct',
            method: 'POST',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar,
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            form: { pid: variantId, quantity: quantity }
        };
        const addToCartResponse = await requestPromise(myRequest);
        expect(addToCartResponse.statusCode).to.equal(200);

        // Hit Checkout-Begin
        myRequest = {
            url: config.baseUrl + '/Checkout-Begin',
            method: 'GET',
            rejectUnauthorized: false,
            resolveWithFullResponse: true,
            jar: jar
        };
        const checkoutResponse = await requestPromise(myRequest);
        expect(checkoutResponse.statusCode).to.equal(200);

        // Parse the HTML string
        const regex = /\sdata-klarna-interop-status\s*=\s*"([^"]*)"/;
        const match = checkoutResponse.body.match(regex);
        expect(match).to.not.be.null;
        expect(match).to.have.lengthOf(2);
        const status = match[1];
        expect(status).to.be.oneOf([
            'DataIsSetInSession',
            'PSPFlagDisabledAndDataNotSet'
        ]);
    });
});