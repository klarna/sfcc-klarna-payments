'use strict';

/**
 * address request model
 * @returns {void}
 */
function Address() {
    this.title = '';
    this.given_name = '';
    this.family_name = '';
    this.email = '';
    this.phone = '';
    this.street_address = '';
    this.street_address2 = '';
    this.postal_code = '';
    this.city = '';
    this.region = '';
    this.country = '';
}

/**
 * customer request model
 * @returns {void}
 */
function Customer() {
}

/**
 * KP Order Request Model
 * @returns {void}
 */
function KlarnaPaymentsCustomerTokenModel() {
    this.purchase_country = '';
    this.purchase_currency = '';
    this.locale = '';
    this.billing_address = new Address();
    this.customer = new Customer();
    this.description = '';
    this.intended_use = 'SUBSCRIPTION';
}


module.exports.KlarnaPaymentsCustomerTokenModel = KlarnaPaymentsCustomerTokenModel;
module.exports.Customer = Customer;
module.exports.Address = Address;
