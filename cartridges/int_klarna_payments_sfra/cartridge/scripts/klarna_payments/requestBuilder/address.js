'use strict';

var Builder = require('~/cartridge/scripts/common/Builder');
var AddressRequestModel = require('~/cartridge/scripts/klarna_payments/model/request/session').Address;
var strval = require('~/cartridge/scripts/util/KlarnaUtils').strval;
var empty = require('~/cartridge/scripts/util/KlarnaUtils').empty;

function Address() {
    this.address = null;
}

Address.prototype = new Builder();

Address.prototype.copyFromCustomerPreferredAddress = function (currentCustomer) {
    var customerPreferredAddress = currentCustomer.addressBook.preferredAddress;

    if (!empty(customerPreferredAddress)) {
        this.address.phone = customerPreferredAddress.phone;
        this.address.given_name = customerPreferredAddress.firstName;
        this.address.family_name = customerPreferredAddress.lastName;
        this.address.street_address = strval(customerPreferredAddress.address1);
        this.zthis.address.street_address2 = strval(customerPreferredAddress.address2);
        this.address.postal_code = strval(customerPreferredAddress.postalCode);
        this.address.city = strval(customerPreferredAddress.city);
        this.address.region = strval(customerPreferredAddress.stateCode);
        this.address.country = strval(customerPreferredAddress.getCountryCode().value);
    }
};

Address.prototype.copyFromCustomerProfile = function (basket) {
    var currentCustomer = basket.getCustomer();

    this.address.email = currentCustomer.profile.email;
    this.address.phone = currentCustomer.profile.phoneMobile;
    this.address.given_name = currentCustomer.profile.firstName;
    this.address.family_name = currentCustomer.profile.lastName;

    this.copyFromCustomerPreferredAddress(currentCustomer);
};

Address.prototype.copyFromShippingAddress = function (basket) {
    var shippingAddress = basket.getShipments().iterator().next().getShippingAddress();

    if (shippingAddress) {
        this.address.given_name = shippingAddress.getFirstName();
        this.address.family_name = shippingAddress.getLastName();
        this.address.email = strval(basket.getCustomerEmail());
        this.address.title = strval(shippingAddress.getTitle());
        this.address.street_address = shippingAddress.getAddress1();
        this.address.street_address2 = strval(shippingAddress.getAddress2());
        this.address.postal_code = shippingAddress.getPostalCode();
        this.address.city = shippingAddress.getCity();
        this.address.region = shippingAddress.getStateCode();
        this.address.phone = shippingAddress.getPhone();
        this.address.country = shippingAddress.getCountryCode().value;
    }
};

Address.prototype.build = function (basket) {
    this.address = new AddressRequestModel();
    var currentCustomer = basket.getCustomer();

    if (empty(currentCustomer) || empty(currentCustomer.profile)) {
        this.copyFromShippingAddress(basket);
    } else {
        this.copyFromCustomerProfile(basket);
    }

    return this.address;
};

module.exports = Address;