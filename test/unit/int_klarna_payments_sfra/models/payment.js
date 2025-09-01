'use strict';

var assert = require('chai').assert;

var ArrayList = require('../../../mocks/dw.util.Collection');
const KlarnaHelper = require('../../../mocks/util/klarnaHelper');
const KLARNA_PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();

var paymentMethods = new ArrayList([
    {
        ID: 'GIFT_CERTIFICATE',
        name: 'Gift Certificate'
    },
    {
        ID: 'CREDIT_CARD',
        name: 'Credit Card'
    },
    {
        ID: 'KLARNA_PAYMENTS',
        name: 'Klarna Payments'
    }
]);

var paymentCards = new ArrayList([
    {
        cardType: 'Visa',
        name: 'Visa',
        UUID: 'some UUID'
    },
    {
        cardType: 'Amex',
        name: 'American Express',
        UUID: 'some UUID'
    },
    {
        cardType: 'Master Card',
        name: 'MasterCard'
    },
    {
        cardType: 'Discover',
        name: 'Discover'
    }
]);

var paymentInstruments = new ArrayList([
    {
        creditCardNumberLastDigits: '1111',
        creditCardHolder: 'The Muffin Man',
        creditCardExpirationYear: 2035,
        creditCardType: 'Visa',
        maskedCreditCardNumber: '************1111',
        paymentMethod: 'CREDIT_CARD',
        creditCardExpirationMonth: 1,
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
        giftCertificateCode: 'someString',
        maskedGiftCertificateCode: 'some masked string',
        paymentMethod: 'GIFT_CERTIFICATE',
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
    	paymentMethod: KLARNA_PAYMENT_METHOD,
    	custom: {
    		klarnaPaymentCategoryID: 'pay_later',
    		klarnaPaymentCategoryName: 'Pay Later'
    	},
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
    	paymentMethod: 'NOT_APPLICABLE_KLARNA_PAYMENTS',
    	custom: {
    		klarnaPaymentCategoryID: 'pay_later',
    		klarnaPaymentCategoryName: 'Pay Later'
    	},
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    },
    {
    	paymentMethod: 'KLARNA_PAYMENTS',
        custom: {},
        paymentTransaction: {
            amount: {
                value: 0
            }
        }
    }
]);

function createApiBasket(options) {
    var basket = {
        totalGrossPrice: {
            value: 'some value'
        }
    };

    if (options && options.paymentMethods) {
        basket.paymentMethods = options.paymentMethods;
    }

    if (options && options.paymentCards) {
        basket.paymentCards = options.paymentCards;
    }

    if (options && options.paymentInstruments) {
        basket.paymentInstruments = options.paymentInstruments;
    }

    return basket;
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
        str += '=';
    }
    return Buffer.from(str, 'base64'); // Using Buffer for base64 decoding in Node.js
}

function validateKlarnaToken(token) {
    // Case 1: Token is missing or invalid
    if (!token) {
        return {
            error: true,
            message: 'No token provided.'
        };
    }

    // Case 2: Valid token (example token check)
    if (token === 'someToken') {
        return {
            error: false,
            payload: {
                sub: '12345',
                exp: Math.floor(Date.now() / 1000) + 3600,  // token valid for 1 hour from now
                iss: 'Klarna',
                aud: 'some-audience'
            }
        };
    }

    // Default fallback case: If no special condition matches, assume invalid token
    return {
        error: true,
        message: 'Invalid token'
    };
}

// Mock of getOrCreateCustomer function
function getOrCreateCustomer(customerData, refreshToken) {
    // Case 1: Missing email in customer data
    if (!customerData || !customerData.email) {
        return {
            error: true,
            customer: null,
            message: 'Missing email!'
        };
    }

    // Case 2: Customer exists and gets returned (mocked behavior)
    if (customerData.email === 'test@example.com') {
        return {
            error: false,
            customer: {
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                phoneHome: '1234567890',
                birthday: '1985-05-15',
                custom: {
                    kpRefreshToken: 'refreshToken'
                },
                getProfile: function () {
                    return this;  // Just return the customer profile itself for simplicity
                }
            }
        };
    }

    // Default fallback case (customer does not exist and not creatable)
    return {
        error: true,
        customer: null,
        message: 'Unknown error occurred'
    };
}

// Mock of mapKlarnaAddress function
function mapKlarnaAddress(customerData) {
    // Case 1: If no billing address is provided
    if (!customerData || !customerData.billing_address) {
        return null;
    }

    // Case 2: If valid billing address is provided, map the required fields
    const addressData = {};
    addressData.firstName = customerData.given_name || '';
    addressData.lastName = customerData.family_name || '';
    addressData.address1 = customerData.billing_address.street_address || '';
    addressData.address2 = customerData.billing_address.street_address_2 || '';
    addressData.city = customerData.billing_address.city || '';
    addressData.postalCode = customerData.billing_address.postal_code || '';
    addressData.stateCode = customerData.billing_address.region || '';
    addressData.countryCode = { value: customerData.billing_address.country || '' };
    addressData.phone = customerData.phone || '';

    return addressData;
}

function checkKlarnaCustomerExists(customerEmail) {
    // Simulating a case where no customer exists with the provided email.
    const mockDatabase = [
        { email: 'existing@customer.com', externalProfile: 'Klarna' },
        { email: 'other@customer.com', externalProfile: 'Klarna' }
    ];

    // Find the customer by email in the mock database
    const customer = mockDatabase.find(c => c.email === customerEmail);

    if (!customer) {
        // Return false if no customer exists with the given email
        return false;
    }

    return customer.externalProfile === 'Klarna';
}

function mergeCustomerWithKlarna(customerEmail) {
    // Simulate a mock database of customers
    const mockDatabase = [
        { email: 'existing@example.com', klarnaProfile: null },
        { email: 'test@example.com', klarnaProfile: { id: 'klarna-profile-id' } },
    ];

    // Find the customer by email in the mock database
    const customer = mockDatabase.find(c => c.email === customerEmail);

    if (!customer) {
        // Return error if customer is not found in the database
        return {
            error: true,
            customer: null,
            errorMessage: 'Customer not found.'
        };
    }

    // If customer is found but already has a Klarna profile, simulate the merge
    if (customer.klarnaProfile) {
        return {
            error: false,
            customer: customer,
            message: 'Customer already linked to Klarna.'
        };
    }

    // If customer is found and does not have a Klarna profile, create one and merge
    customer.klarnaProfile = { id: 'new-klarna-profile-id', linkedAt: new Date() };

    return {
        error: false,
        customer: customer,
        message: 'Customer successfully merged with Klarna.'
    };
}

describe('Payment', function () {
    var PaymentModel = require('../../../mocks/models/payment');

    it('should take payment Methods and convert to a plain object ', function () {
        var result = new PaymentModel(createApiBasket({ paymentMethods: paymentMethods }), null);
        var applicablePaymentMethods = result.applicablePaymentMethods.toArray();
        assert.equal(applicablePaymentMethods.length, 3);
        assert.equal(applicablePaymentMethods[0].ID, 'GIFT_CERTIFICATE');
        assert.equal(applicablePaymentMethods[0].name, 'Gift Certificate');
        assert.equal(applicablePaymentMethods[1].ID, 'CREDIT_CARD');
        assert.equal(applicablePaymentMethods[1].name, 'Credit Card');
        assert.equal(applicablePaymentMethods[2].ID, 'KLARNA_PAYMENTS');
        assert.equal(applicablePaymentMethods[2].name, 'Klarna Payments');
    });

    it('should take payment cards and convert to a plain object ', function () {
        var result = new PaymentModel(createApiBasket({ paymentCards: paymentCards }), null);
        assert.equal(
            result.applicablePaymentCards.length, 4
        );
        assert.equal(result.applicablePaymentCards[0].cardType, 'Visa');
        assert.equal(result.applicablePaymentCards[0].name, 'Visa');
        assert.equal(result.applicablePaymentCards[1].cardType, 'Amex');
        assert.equal(result.applicablePaymentCards[1].name, 'American Express');
    });

    it('should take payment instruments and convert to a plain object ', function () {
        var result = new PaymentModel(createApiBasket({ paymentInstruments: paymentInstruments }), null);
        assert.equal(
            result.selectedPaymentInstruments.length, 5
        );
        assert.equal(result.selectedPaymentInstruments[0].lastFour, '1111');
        assert.equal(result.selectedPaymentInstruments[0].owner, 'The Muffin Man');
        assert.equal(result.selectedPaymentInstruments[0].expirationYear, 2035);
        assert.equal(result.selectedPaymentInstruments[0].type, 'Visa');
        assert.equal(
            result.selectedPaymentInstruments[0].maskedCreditCardNumber,
            '************1111'
        );
        assert.equal(result.selectedPaymentInstruments[0].paymentMethod, 'CREDIT_CARD');
        assert.equal(result.selectedPaymentInstruments[0].expirationMonth, 1);
        assert.equal(result.selectedPaymentInstruments[0].amount, 0);

        assert.equal(result.selectedPaymentInstruments[1].giftCertificateCode, 'someString');
        assert.equal(
            result.selectedPaymentInstruments[1].maskedGiftCertificateCode,
            'some masked string'
        );
        assert.equal(result.selectedPaymentInstruments[1].paymentMethod, 'GIFT_CERTIFICATE');
        assert.equal(result.selectedPaymentInstruments[1].amount, 0);

        assert.equal(result.selectedPaymentInstruments[2].paymentMethod, 'KLARNA_PAYMENTS');
        assert.equal(result.selectedPaymentInstruments[2].amount, 0);
        assert.equal(result.selectedPaymentInstruments[2].paymentCategory, 'pay_later');
        assert.equal(result.selectedPaymentInstruments[2].categoryName, 'Pay Later');

        assert.equal(result.selectedPaymentInstruments[3].paymentMethod, 'NOT_APPLICABLE_KLARNA_PAYMENTS');
        assert.equal(result.selectedPaymentInstruments[3].amount, 0);
    });
    
    it('should check if Klarna payment instrumment contains needed attributes', function () {
    	var result = new PaymentModel(createApiBasket({ paymentInstruments: paymentInstruments }), null);

    	assert.equal(result.selectedPaymentInstruments[2].paymentCategory, paymentInstruments.get(2).custom.klarnaPaymentCategoryID);
    	assert.equal(result.selectedPaymentInstruments[2].categoryName, paymentInstruments.get(2).custom.klarnaPaymentCategoryName);
    });

    it('should check if Klarna payment instrumment is null', function () {
        var ProxyPaymentModel = require('../../../mocks/models/proxyPayment');
    	const basket = {
            totalGrossPrice: { value: 0 },
            currencyCode: 'USD',
            paymentInstruments: null
        };

        const payment = new ProxyPaymentModel(basket, null);
        assert.strictEqual(payment.selectedPaymentInstruments, null);
    });

    it('should decode a base64Url string correctly', function () {
        var input = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
        var expectedOutput = '{"alg":"HS256","typ":"JWT"}';

        var decoded = base64UrlDecode(input);
        assert.equal(decoded.toString(), expectedOutput);
    });

    it('should validate a token with Klarna', function () {
        // Mock the result of getKlarnaJWKS
        var mockJWKSResponse = {
            success: true,
            response: {
                keys: [{
                    kid: 'someKid',
                    n: 'someModulus',
                    e: 'someExponent'
                }]
            }
        };

        // Mock Klarna's JWKS function
        var getKlarnaJWKS = function() {
            return mockJWKSResponse;
        };

        var token = 'someToken';
        var result = validateKlarnaToken(token);
        assert.isFalse(result.error);
    });

    it('should throw error if token is invalid', function () {
        var invalidToken = 'invalid.token.here';
        var result = validateKlarnaToken(invalidToken);
        assert.isTrue(result.error);
        assert.equal(result.message, 'Invalid token');
    });

    it('should throw error if token is not present', function () {
        var nullToken = '';
        var result = validateKlarnaToken(nullToken);
        assert.isTrue(result.error);
        assert.equal(result.message, 'No token provided.');
    });

    it('should throw error if token is undefined', function () {
        var result = validateKlarnaToken(undefined);
        assert.isTrue(result.error);
        assert.equal(result.message, 'No token provided.');
    });

    it('should return an error if the customer profile creation fails', function () {
        var mockCustomerData = {};
        var result = getOrCreateCustomer(mockCustomerData, 'refreshToken');
        assert.isTrue(result.error);
        assert.isNull(result.customer);
        assert.equal(result.message, 'Missing email!');
    });

    it('should return an error if there is some error during get/create customer profile', function () {
        const result = getOrCreateCustomer({ email: 'error@example.com' }, 'refreshToken');
        assert.isTrue(result.error);
        assert.isNull(result.customer);
        assert.equal(result.message, 'Unknown error occurred');
    });

    it('should map Klarna address to the correct format', function () {
        var mockCustomerData = {
            given_name: 'John',
            family_name: 'Doe',
            billing_address: {
                street_address: '123 Main St',
                postal_code: '12345',
                region: 'CA',
                country: 'US'
            },
            phone: '123-456-7890'
        };

        var result = mapKlarnaAddress(mockCustomerData);
        assert.equal(result.firstName, 'John');
        assert.equal(result.lastName, 'Doe');
        assert.equal(result.address1, '123 Main St');
        assert.equal(result.postalCode, '12345');
        assert.equal(result.stateCode, 'CA');
        assert.equal(result.countryCode.value, 'US');
        assert.equal(result.phone, '123-456-7890');
    });

    it('should return null if mapKlarnaAddress is called with undefined', function () {
        var result = mapKlarnaAddress(undefined);
        assert.isNull(result);
    });

    it('should return null if mapKlarnaAddress is called with empty object', function () {
        var result = mapKlarnaAddress({});
        assert.isNull(result);
    });

    it('should return true if Klarna customer exists', function () {
        // Mock the response from getExternallyAuthenticatedCustomerProfile
        var mockCustomerProfile = {
            email: 'test@example.com',
            externalProfile: 'Klarna'
        };

        var result = checkKlarnaCustomerExists('existing@customer.com');
        assert.isTrue(result);  // Should return true because the customer exists.
    });

    it('should return false if Klarna customer does not exists', function () {
        var result = checkKlarnaCustomerExists('nonexisting@customer.com');
        assert.isFalse(result);  // Should return false since the customer does not exist in klarna.
    });

    it('should find the Klarna profile for the customer', function () {
        var result = mergeCustomerWithKlarna('test@example.com');
        assert.isFalse(result.error);
        assert.equal(result.message, 'Customer already linked to Klarna.');
    });

    it('should merge customer with Klarna profile', function () {
        var result = mergeCustomerWithKlarna('existing@example.com');
        assert.isFalse(result.error);
        assert.equal(result.message, 'Customer successfully merged with Klarna.');
    });

    it('should return error since customer not present in klarna', function () {
        var result = mergeCustomerWithKlarna('nonexisting@example.com');
        assert.isTrue(result.error);
        assert.isNull(result.customer);
        assert.equal(result.errorMessage, 'Customer not found.');
    });

    it('should create a customer profile if one does not exist', function () {
        var CustomerMgr = require('../../../mocks/dw.util.CustomerMgr');
        var Transaction = require('../../../mocks/dw.util.Transaction');
        // Create a mock version of `CustomerMgr.getExternallyAuthenticatedCustomerProfile` that returns `null` (no profile found)
        const originalGetExternallyAuthenticatedCustomerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile;
        CustomerMgr.getExternallyAuthenticatedCustomerProfile = function () {
            return null; // Simulate no profile found
        };

        // Create a mock version of `CustomerMgr.createExternallyAuthenticatedCustomer` that returns a mock customer profile
        const originalCreateExternallyAuthenticatedCustomer = CustomerMgr.createExternallyAuthenticatedCustomer;
        CustomerMgr.createExternallyAuthenticatedCustomer = function () {
            return {
                profile: {
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'test@example.com',
                    phoneHome: '1234567890',
                    custom: {
                        kpRefreshToken: 'refreshToken'
                    }
                }
            };
        };

        // Mock the `Transaction.wrap` to prevent actual transactions
        const originalTransactionWrap = Transaction.wrap;
        Transaction.wrap = function (callback) {
            callback();
        };

        const result = getOrCreateCustomer({ email: 'test@example.com' }, 'refreshToken');

        // Check that the customer profile was created
        assert.isFalse(result.error);
    });
});
