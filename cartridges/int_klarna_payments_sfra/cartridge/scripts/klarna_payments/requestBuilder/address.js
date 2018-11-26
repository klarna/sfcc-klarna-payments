/* globals empty */

'use strict';

var Builder = require('~/cartridge/scripts/common/Builder');
var AddressRequestModel = require('~/cartridge/scripts/klarna_payments/model/request/session').Address;
var strval = require('~/cartridge/scripts/util/KlarnaUtils').strval;

/**
 * Address request builder
 */
function Address() {
    this.address = null;
}

Address.prototype = new Builder();

Address.prototype.build = function (dwAddress) {
    this.address = new AddressRequestModel();

    this.address.phone = dwAddress.phone;
    this.address.given_name = dwAddress.firstName;
    this.address.family_name = dwAddress.lastName;
    this.address.street_address = strval(dwAddress.address1);
    this.address.street_address2 = strval(dwAddress.address2);
    this.address.postal_code = strval(dwAddress.postalCode);
    this.address.city = strval(dwAddress.city);
    this.address.region = strval(dwAddress.stateCode);
    this.address.country = strval(dwAddress.getCountryCode().value);

    return this.address;
};

module.exports = Address;
