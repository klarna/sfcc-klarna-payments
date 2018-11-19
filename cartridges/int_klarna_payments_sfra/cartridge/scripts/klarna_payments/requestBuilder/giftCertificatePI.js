/* globals empty */

'use strict';

var Builder = require('~/cartridge/scripts/common/Builder');
var LineItem = require('~/cartridge/scripts/klarna_payments/model/request/session').LineItem;

var ORDER_LINE_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 */
function GiftCertificatePI() {
    this.item = null;
}

GiftCertificatePI.prototype = new Builder();

GiftCertificatePI.prototype.build = function (li) {
    var paymentTransaction = li.getPaymentTransaction();

    this.item = new LineItem();
    this.item.quantity = 1;
    this.item.type = ORDER_LINE_TYPE.GIFT_CERTIFICATE_PI;
    this.item.name = 'Gift Certificate';
    this.item.reference = li.getMaskedGiftCertificateCode();
    this.item.unit_price = paymentTransaction.getAmount() * 100 * (-1);
    this.item.tax_rate = 0;
    this.item.total_amount = paymentTransaction.getAmount() * 100 * (-1);
    this.item.total_tax_amount = 0;

    return this.item;
};

module.exports = GiftCertificatePI;
