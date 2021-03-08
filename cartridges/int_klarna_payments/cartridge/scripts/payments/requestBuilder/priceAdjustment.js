/* globals empty */

'use strict';

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/session' ).LineItem;

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @return {void}
 */
function PriceAdjustment() {
    this.item = null;
    this.pid = null;
    this.oid = null;
}

PriceAdjustment.prototype = new Builder();

PriceAdjustment.prototype.setProductId = function( pid ) {
    this.pid = pid;
};

PriceAdjustment.prototype.setObjectId = function( oid ) {
    this.oid = oid;
};

PriceAdjustment.prototype.getProductId = function() {
    return this.pid;
};

PriceAdjustment.prototype.getObjectId = function() {
    return this.oid;
};

PriceAdjustment.prototype.getPriceAdjustmentPromoName = function( adj ) {
    var promoName = !empty( adj.promotion ) && !empty( adj.promotion.name ) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;

    return promoName;
};

PriceAdjustment.prototype.getPriceAdjustmentPromoId = function( adj ) {
    var promoId = adj.promotionID;
    var pid = this.getProductId();
    var oid = this.getObjectId();

    if ( !empty( pid ) ) {
        promoId = pid + '_' + promoId;
    } else if ( !empty( oid ) ) {
        promoId = oid + '_' + promoId;
    }

    return promoId;
};

PriceAdjustment.prototype.getPriceAdjustmentMerchantData = function( adj ) {
    return ( adj.couponLineItem ? adj.couponLineItem.couponCode : '' );
};

PriceAdjustment.prototype.getPriceAdjustmentTaxRate = function( adj ) {
    return ( isTaxationPolicyNet() ) ? 0 : Math.round( adj.taxRate * 10000 );
};

PriceAdjustment.prototype.getPriceAdjustmentTotalTaxAmount = function( adj ) {
    return ( isTaxationPolicyNet() ) ? 0 : Math.round( adj.tax.value * 100 );
};

PriceAdjustment.prototype.getPriceAdjustmentUnitPrice = function( adj ) {
    return ( adj.grossPrice.available && !isTaxationPolicyNet() ? adj.grossPrice.value : adj.netPrice.value ) * 100;
};

PriceAdjustment.prototype.build = function( adj ) {
    var adjusmentPrice = Math.round( this.getPriceAdjustmentUnitPrice( adj ) );

    this.adjustment = new LineItem();
    this.adjustment.quantity = 1;
    this.adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
    this.adjustment.name = this.getPriceAdjustmentPromoName( adj );
    this.adjustment.reference = this.getPriceAdjustmentPromoId( adj );
    this.adjustment.unit_price = adjusmentPrice;
    this.adjustment.merchant_data = this.getPriceAdjustmentMerchantData( adj );
    this.adjustment.tax_rate = this.getPriceAdjustmentTaxRate( adj );
    this.adjustment.total_amount = adjusmentPrice;
    this.adjustment.total_tax_amount = this.getPriceAdjustmentTotalTaxAmount( adj );

    return this.adjustment;
};

module.exports = PriceAdjustment;
