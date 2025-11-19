/* globals empty */
'use strict';

var URLUtils = require( 'dw/web/URLUtils' );
var Money = require( 'dw/value/Money' );

var Builder = require( '*/cartridge/scripts/payments/builder' );

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();

/**
 * Ensures amount is rounded to 2 decimals first, then converted to minor units
 * @param {number} amount amount to be converted
 * @return {number} amount in minor units
 */
function toMinorUnits( amount ) {
    return Math.round( parseFloat( amount.toFixed( 2 ) )* 100 );
}

/**
 * Supplementary Purchase Data Builder for Klarna
 * @return {void}
 */
function SupplementaryPurchaseData() {
    this.data = {};
}

SupplementaryPurchaseData.prototype = new Builder();

SupplementaryPurchaseData.prototype.getItemPrice = function( li ) {
    var amount = li.grossPrice.available && !isTaxationPolicyNet() ? li.grossPrice.value : li.netPrice.value;
    return toMinorUnits( amount );
};

SupplementaryPurchaseData.prototype.getItemProratedPrice = function( li ) {
    return li.proratedPrice.available ? toMinorUnits( li.proratedPrice.value ) : 0;
};

SupplementaryPurchaseData.prototype.getItemTaxAmount = function( li ) {
    return isTaxationPolicyNet() ? 0 : toMinorUnits( li.tax.value );
};

SupplementaryPurchaseData.prototype.getItemReference = function( li ) {
    if ( li.optionProductLineItem ) {
        return `${li.parent.productID}_${li.optionID}_${li.optionValueID}`;
    }
    return li.productID;
};

SupplementaryPurchaseData.prototype.generateItemProductURL = function( li ) {
    var pid = li.optionProductLineItem ? li.parent.productID : li.productID;
    return URLUtils.https( 'Product-Show', 'pid', pid ).toString();
};

SupplementaryPurchaseData.prototype.generateItemImageURL = function( li ) {
    var product = li.optionProductLineItem ? li.parent.getProduct() : li.getProduct();
    if ( product && product.getImage( 'small', 0 ) ) {
        return product.getImage( 'small', 0 ).getImageURL( {} ).toString();
    }
    return '';
};

SupplementaryPurchaseData.prototype.generateShippingReference = function( li ) {
    var shippingId = li.shipment && li.shipment.shippingMethod ? li.shipment.shippingMethod.ID : '';
    return shippingId;
};

SupplementaryPurchaseData.prototype.buildLineItems = function( basket ) {
    var items = [];
    var productLineItems = basket.getAllProductLineItems().toArray();

    productLineItems.forEach( li => {
        var itemPrice = this.getItemPrice( li );
        var itemProratedPrice = this.getItemProratedPrice( li );
        var quantity = li.quantityValue;
        var currencyCode = li.getPrice().getCurrencyCode();
        var itemPriceMoney = new Money( itemPrice, currencyCode );
        var totalTaxAmount = this.getItemTaxAmount( li );

        var totalAmount = isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' ) ? itemProratedPrice : itemPrice;

        var item = {
            name: li.productName,
            quantity: quantity,
            total_amount: totalAmount,
            total_tax_amount: totalTaxAmount,
            unit_price: itemPriceMoney.divide( quantity ).getValue(),
            product_url: this.generateItemProductURL( li ),
            image_url: this.generateItemImageURL( li ),
            product_identifier: li.productID,
            line_item_reference: this.getItemReference( li ),
            shipping_reference: this.generateShippingReference( li )
        };

        items.push( item );
    } );

    return items;
};

SupplementaryPurchaseData.prototype.build = function( basket ) {
    this.data.line_items = this.buildLineItems( basket );
    return this.data;
};

module.exports = SupplementaryPurchaseData;
