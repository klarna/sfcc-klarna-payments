'use strict';

var base = module.superModule;

/**
 * Get customer subscriptions from his profile
 * @param {Object} profile customer profile
 * @returns available Klarna subscriptions
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
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 * @constructor
 */
function account(currentCustomer, addressModel, orderModel) {
    base.call(this, currentCustomer, addressModel, orderModel);

    this.subscriptions = getSubscriptions('raw' in currentCustomer ? currentCustomer.raw.profile : currentCustomer.profile);
}

account.prototype = Object.create(base.prototype);
module.exports = account;