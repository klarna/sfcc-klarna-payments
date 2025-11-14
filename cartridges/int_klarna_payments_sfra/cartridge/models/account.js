'use strict';

var base = module.superModule;

/**
 * Get customer subscriptions from his profile
 * @param {Object} profile customer profile
 * @returns {Array} available Klarna subscriptions
 */
function getSubscriptions(profile) {
    var subscriptions = [];
    if (profile && profile.custom.kpSubscriptions) {
        subscriptions = JSON.parse(profile.custom.kpSubscriptions);
    }
    return subscriptions;
}

/**
 * Order class that represents the current order
 * @param {dw.customer.Customer} currentCustomer - The current logged-in customer object.
 * @param {Object} addressModel - The address model associated with the customer account.
 * @param {Object} orderModel - The order model representing the customer's order history.
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
    base.call(this, currentCustomer, addressModel, orderModel);

    this.subscriptions = getSubscriptions('raw' in currentCustomer ? currentCustomer.raw.profile : currentCustomer.profile);
}

account.prototype = Object.create(base.prototype);
module.exports = account;
