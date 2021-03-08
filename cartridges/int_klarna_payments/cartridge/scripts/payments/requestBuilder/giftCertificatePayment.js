/* globals empty */

'use strict';

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/session' ).LineItem;

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @returns {void}
 */
function GiftCertificatePayment() {
    this.item = null;
}

GiftCertificatePayment.prototype = new Builder();

GiftCertificatePayment.prototype.getItemPrice = function( li ) {
    var paymentTransaction = li.getPaymentTransaction();
    return paymentTransaction.getAmount() * 100 * ( -1 );
};

GiftCertificatePayment.prototype.getItemName = function( li ) {
    return li.productName;
};

GiftCertificatePayment.prototype.build = function( li ) {
    var itemPrice = this.getItemPrice( li );

    this.item = new LineItem();
    this.item.type = ORDER_LINE_TYPE.GIFT_CERTIFICATE_PI;
    this.item.reference = li.getMaskedGiftCertificateCode();
    this.item.quantity = 1;
    this.item.name = 'Gift Certificate';
    this.item.unit_price = itemPrice;
    this.item.tax_rate = 0;
    this.item.total_amount = itemPrice;
    this.item.total_tax_amount = 0;

    return this.item;
};

module.exports = GiftCertificatePayment;
