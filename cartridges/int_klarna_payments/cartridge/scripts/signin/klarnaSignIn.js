'use strict';

var Bytes = require( 'dw/util/Bytes' );
var Encoding = require( 'dw/crypto/Encoding' );
var Signature = require( 'dw/crypto/Signature' );
var Logger = require( 'dw/system/Logger' );

function base64UrlDecode( str ) {
    var localStr = str.replace( /-/g, '+' ).replace( /_/g, '/' );
    while ( localStr.length % 4 ) {
        localStr += '=';
    }
    return Encoding.fromBase64( localStr );
}
/**
 * Execute Klarna call to get JWKS
 * @returns {object} Klarna JWKS response
 */
function getKlarnaJWKS() {
    var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
    var localeObject = KlarnaHelper.getLocale();
    var klarnaSignInRefreshTokenHelper = require( '*/cartridge/scripts/signin/klarnaSignInRefreshToken' );
    var klarnaSignInRefreshTokenResponse = klarnaSignInRefreshTokenHelper.getKlarnaJWKS( localeObject );
    return klarnaSignInRefreshTokenResponse;
}
/**
 * Execute Refresh Token call
 * @param {String} refreshToken refresh token
 * @returns {object} Refresh Token response
 */
function refreshCustomerSignInToken( refreshToken ) {
    var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
    var localeObject = KlarnaHelper.getLocale();
    var klarnaSignInRefreshTokenHelper = require( '*/cartridge/scripts/signin/klarnaSignInRefreshToken' );
    var klarnaSignInRefreshTokenResponse = klarnaSignInRefreshTokenHelper.refreshSignInToken( localeObject, refreshToken );
    return klarnaSignInRefreshTokenResponse.response;
}
/**
 * Validate Klarna tokens
 * @param {String} token Token to be validated
 * @returns {String} payload result
 */
function validateToken( token ) {
    var rsaToPem = require( '*/cartridge/scripts/signin/rsaToPem' );
    // Split the token into parts
    var parts = token.split( '.' );
    if ( parts.length !== 3 ) {
        throw new Error( 'Invalid token' );
    }
    var header = JSON.parse( base64UrlDecode( parts[0] ).toString() );
    var payload = JSON.parse( base64UrlDecode( parts[1] ).toString() );
    var tokenSignature = base64UrlDecode( parts[2] );
    // Step 1: Retrieve JWKS
    var result = getKlarnaJWKS();
    if ( !result.success ) {
        throw new Error( 'Failed to retrieve JWKS from Klarna: ' + result.message );
    }
    var jwks = result.response;
    // Step 2: Find the Signing Key
    var jwk = jwks.keys.find( function( key ) { return key.kid === header.kid; } );
    if ( !jwk ) {
        throw new Error( 'Key ID not found in JWKS' );
    }
    var publicKey = rsaToPem.getRSAPublicKey( jwk.n, jwk.e );
    // Step 3: Verify the Signature
    var signature = new Signature();
    var contentBytes = new Bytes( parts[0] + '.' + parts[1], 'UTF-8' );
    var verifySignature = signature.verifyBytesSignature( tokenSignature, contentBytes, publicKey, 'SHA256withRSA' );
    if ( !verifySignature ) {
        throw new Error( 'Token signature verification failed' );
    }
    // Step 4: Check Claims
    if ( payload.exp <= Date.now() / 1000 ) {
        throw new Error( 'Token validation failed' );
    }
    return payload;
}
/**
 * Validate token received from Klarna
 * @param {String} klarnaToken Klarna customer tokens for validation
 * @returns {Object} validation result
 */
function validateKlarnaToken( klarnaToken ) {
    if ( !klarnaToken ) {
        return {
            error: true,
            message: 'No token provided.'
        }
    }
    var result = {
        error: false
    }
    try {
        var payload = validateToken( klarnaToken );
        result.payload = payload;
    } catch ( err ) {
        Logger.error( 'Failed to validate token - ' + err.message );
        result = {
            error: true,
            message: err.message
        }
    }
    return result;
}
/**
 * Get or create customer based on the external Klarna profile
 * @param {Object} customerData customer details
 * @param {String} refreshToken refresh token
 * @returns {Object} customer profile
 */
function getOrCreateCustomer( customerData, refreshToken ) {
    var CustomerMgr = require( 'dw/customer/CustomerMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var customerProfile = null;
    var extProfile = null;
    if ( !customerData || !customerData.email ) {
        return {
            error: true,
            customer: null,
            message: 'Missing email!'
        }
    }
    Transaction.wrap( function() { // eslint-disable-line consistent-return
        customerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile( 'Klarna', customerData.email );
        if ( !customerProfile ) {
            var customer = CustomerMgr.createExternallyAuthenticatedCustomer( 'Klarna', customerData.email );
            if ( !customer ) {
                Logger.error( 'External customer profile cannot be created.' );
                return {
                    error: true,
                    customer: null,
                    erroMessage: 'External customer profile cannot be created.'
                };
            }
            customerProfile = customer.profile;
        }
        extProfile = customerProfile.customer.getExternalProfile( 'Klarna', customerData.email );
        if ( extProfile && !extProfile.email ) {
            extProfile.email = customerData.email;
        }
        customerProfile.firstName = customerData.given_name || customerProfile.firstName;
        customerProfile.lastName = customerData.family_name || customerProfile.lastName;
        customerProfile.email = customerData.email;
        customerProfile.phoneHome = customerData.phone;
        try {
            customerProfile.birthday = new Date( customerData.date_of_birth );
        } catch ( err ) {
            Logger.error( 'Could not update customer birthday - ' + err.message );
        }
        var externalyAuthenticatedCustomer = CustomerMgr.loginExternallyAuthenticatedCustomer( 'Klarna', customerData.email, false );
        if ( !externalyAuthenticatedCustomer ) {
            Logger.error( 'External customer login failed.' );
            return {
                error: true,
                customer: null,
                erroMessage: 'External customer login failed.'
            };
        }
        session.privacy.KlarnaSignedInCustomer = true;

        customerProfile.custom.kpRefreshToken = refreshToken;
    } );
    return {
        error: false,
        customer: customerProfile
    };
}
/**
 * Map Klarna address to expected in checkout address format
 * @param {Object} customerData customer data
 * @returns {Object} address object
 */
function mapKlarnaAddress( customerData ) {
    var addressData = {};
    if ( !customerData || !customerData.billing_address ) {
        return null;
    }
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

/**
 * Check if there is an user with the same email but not
 * linked to Klarna
 * @param {String} customerEmail email
 * @returns {boolean} if the customer exists
 */
function checkCustomerExists( customerEmail ) {
    var CustomerMgr = require( 'dw/customer/CustomerMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var customer = CustomerMgr.getCustomerByLogin( customerEmail );
    if ( !customer ) {
        return false;
    }
    var customerProfile = customer.getExternalProfile( 'Klarna', customerEmail );
    return customerProfile ? false : true;
}

/**
 * Check if there is an user with the same email but not
 * linked to Klarna
 * @param {String} customerEmail email
 * @returns {boolean} if the customer exists
 */
function checkKlarnaCustomerExists( customerEmail ) {
    var CustomerMgr = require( 'dw/customer/CustomerMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var customerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile( 'Klarna', customerEmail );
    if ( !customerProfile ) {
        return false;
    }
    return true;
}

/**
 * Merge existing customer with Klarna data
 * @param {String} customerEmail email
 * @returns {boolean} result of the merge
 */
function mergeCustomerWithKlarna( customerEmail ) {
    var CustomerMgr = require( 'dw/customer/CustomerMgr' );
    var Transaction = require( 'dw/system/Transaction' );
    var customer = CustomerMgr.getCustomerByLogin( customerEmail );
    var customerProfile = null;
    Transaction.wrap( function() {
        customerProfile = customer.createExternalProfile( 'Klarna', customerEmail );
    } );

    if ( !customerProfile ) {
        Logger.error( 'External customer profile cannot be created.' );
        return {
            error: true,
            customer: null,
            erroMessage: 'Customer profile cannot be merged with the Klarna account.'
        };
    }
    return {
        error: false
    };
}

module.exports = {
    getOrCreateCustomer: getOrCreateCustomer,
    mapKlarnaAddress: mapKlarnaAddress,
    validateKlarnaToken: validateKlarnaToken,
    refreshCustomerSignInToken: refreshCustomerSignInToken,
    checkCustomerExists: checkCustomerExists,
    mergeCustomerWithKlarna: mergeCustomerWithKlarna,
    checkKlarnaCustomerExists: checkKlarnaCustomerExists
};