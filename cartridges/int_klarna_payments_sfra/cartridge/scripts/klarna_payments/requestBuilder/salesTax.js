/* globals empty */

'use strict';

var Builder = require('*/cartridge/scripts/klarna_payments/builder');
var LineItem = require('*/cartridge/scripts/klarna_payments/model/request/session').LineItem;

var ORDER_LINE_TYPE = require('*/cartridge/scripts/util/klarnaPaymentsConstants.js').ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 */
function SalesTax() {
    this.item = null;
}

SalesTax.prototype = new Builder();

/**
 * @param {dw.order.LineItemCtnr} lineItemCtnr Customer's basket
 * @return {dw.order.LineItem} Sales tax line item
 */
SalesTax.prototype.build = function (lineItemCtnr) {
    var usTotalTax = Math.round((lineItemCtnr.totalTax.available) ? lineItemCtnr.totalTax.value * 100 : 0);

    this.item = new LineItem();
    this.item.quantity = 1;
    this.item.type = ORDER_LINE_TYPE.SALES_TAX;
    this.item.name = 'Sales Tax';
    this.item.reference = 'Sales Tax';
    this.item.unit_price = usTotalTax;
    this.item.tax_rate = 0;
    this.item.total_amount = usTotalTax;
    this.item.total_tax_amount = 0;

    return this.item;
};

module.exports = SalesTax;
