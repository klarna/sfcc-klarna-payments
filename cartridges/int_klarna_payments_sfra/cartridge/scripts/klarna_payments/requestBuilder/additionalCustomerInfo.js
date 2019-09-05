/* globals empty */

'use strict';

var Builder = require('*/cartridge/scripts/klarna_payments/builder');

var CONTENT_TYPE = require('*/cartridge/scripts/util/klarnaPaymentsConstants.js').CONTENT_TYPE;

/**
 * KP Order Line Item Builder
 */
function AdditionalCustomerInfo() {
    this.item = null;
}

AdditionalCustomerInfo.prototype = new Builder();

AdditionalCustomerInfo.prototype.buildAdditionalCustomerPurchaseHistory = function (customer) {
    var purchaseHistoryFull = [{}];
    purchaseHistoryFull[0].unique_account_identifier = customer.ID;
    purchaseHistoryFull[0].payment_option = 'other';

    if (customer.getActiveData()) {
        purchaseHistoryFull[0].number_paid_purchases = !empty(customer.activeData.orders) ? customer.activeData.orders : 0;
        purchaseHistoryFull[0].total_amount_paid_purchases = !empty(customer.activeData.orderValue) ? customer.activeData.orderValue : 0;
        purchaseHistoryFull[0].date_of_last_paid_purchase = !empty(customer.activeData.lastOrderDate) ? customer.activeData.lastOrderDate.toISOString().slice(0, -5) + 'Z' : '';
        purchaseHistoryFull[0].date_of_first_paid_purchase = '';
    }

    return purchaseHistoryFull;
};

AdditionalCustomerInfo.prototype.buildAdditionalCustomerInfoBody = function (basket) {
    var customer = basket.getCustomer();
    var body = {};

    body.customer_account_info = new Array({});

    if (customer.registered) {
        body.customer_account_info[0].unique_account_identifier = customer.profile.customerNo;
        body.customer_account_info[0].account_registration_date = !empty(customer.profile.creationDate) ? customer.profile.creationDate.toISOString().slice(0, -5) + 'Z' : '';
        body.customer_account_info[0].account_last_modified = !empty(customer.profile.lastModified) ? customer.profile.lastModified.toISOString().slice(0, -5) + 'Z' : '';
    }

    body.purchase_history_full = this.buildAdditionalCustomerPurchaseHistory(customer);

    return JSON.stringify(body);
};

/**
 * @param {dw.order.Basket} basket Customer's basket
 * @return {dw.order.LineItem} Sales tax line item
 */
AdditionalCustomerInfo.prototype.build = function (basket) {
    this.item = {};
    this.item.content_type = CONTENT_TYPE;
    this.item.body = this.buildAdditionalCustomerInfoBody(basket);

    return this.item;
};

module.exports = AdditionalCustomerInfo;
