/* globals empty */

'use strict';

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/session' ).LineItem;

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @return {void}
 */
function GiftCertificateLineItem() {
    this.item = null;
}

GiftCertificateLineItem.prototype = new Builder();

GiftCertificateLineItem.prototype.getItemPrice = function( li ) {
    return ( li.grossPrice.available && !isTaxationPolicyNet() ? li.grossPrice.value : li.netPrice.value ) * 100;
};

GiftCertificateLineItem.prototype.getItemTaxRate = function( li ) {
    return isTaxationPolicyNet() ? 0 : li.taxRate * 10000;
};

GiftCertificateLineItem.prototype.getItemTaxAmount = function( li ) {
    return isTaxationPolicyNet() ? 0 : li.tax.value * 100;
};

GiftCertificateLineItem.prototype.build = function( li ) {
    var itemPrice = this.getItemPrice( li );
    var quantity = 1;

    this.item = new LineItem();
    this.item.type = ORDER_LINE_TYPE.GIFT_CERTIFICATE;
    this.item.reference = li.getGiftCertificateID();
    this.item.quantity = quantity;
    this.item.name = 'Gift Certificate';
    this.item.unit_price = itemPrice;
    this.item.tax_rate = this.getItemTaxRate( li );
    this.item.total_amount = itemPrice;
    this.item.total_tax_amount = this.getItemTaxAmount( li );

    return this.item;
};

module.exports = GiftCertificateLineItem;
