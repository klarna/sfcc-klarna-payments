/* globals empty */

'use strict';

var Builder = require( '*/cartridge/scripts/payments/builder' );
var AddressRequestModel = require( '*/cartridge/scripts/payments/model/request/session' ).Address;
var strval = require( '*/cartridge/scripts/util/klarnaHelper' ).strval;

/**
 * Address request builder
 * @return {void}
 */
function Address() {
    this.address = null;
}

Address.prototype = new Builder();

/**
 * Function to build address data string
 *
 * @param {dw.order.OrderAddress} dwAddress basket address
 * @return {string} flat data
 */
Address.prototype.buildFlat = function( dwAddress ) {
    var flatAddress = '';

    if ( !empty( dwAddress.firstName ) ) {
        flatAddress += ' ' + dwAddress.firstName;
    }

    if ( !empty( dwAddress.lastName ) ) {
        flatAddress += ' ' + dwAddress.lastName;
    }

    if ( !empty( dwAddress.address1 ) ) {
        flatAddress += ' ' + strval( dwAddress.address1 );
    }

    if ( !empty( dwAddress.address2 ) ) {
        flatAddress += ' ' + strval( dwAddress.address2 );
    }

    if ( !empty( dwAddress.city ) ) {
        flatAddress += ' ' + strval( dwAddress.city );
    }

    if ( !empty( dwAddress.stateCode ) ) {
        flatAddress += ' ' + strval( dwAddress.stateCode );
    }

    if ( !empty( dwAddress.postalCode ) ) {
        flatAddress += ' ' + strval( dwAddress.postalCode );
    }

    if ( !empty( dwAddress.phone ) ) {
        flatAddress += ' ' + dwAddress.phone;
    }

    return flatAddress;
};

/**
 * Function to build address
 *
 * @param {dw.order.OrderAddress} dwAddress basket address
 * @return {Object} Address object
 */
Address.prototype.build = function( dwAddress ) {
    this.address = new AddressRequestModel();

    this.address.phone = strval( dwAddress.phone );
    this.address.given_name = dwAddress.firstName;
    this.address.family_name = dwAddress.lastName;
    this.address.street_address = strval( dwAddress.address1 );
    this.address.street_address2 = strval( dwAddress.address2 );
    this.address.postal_code = strval( dwAddress.postalCode );
    this.address.city = strval( dwAddress.city );
    this.address.region = strval( dwAddress.stateCode );
    this.address.country = strval( dwAddress.getCountryCode().value );

    return this.address;
};

module.exports = Address;
