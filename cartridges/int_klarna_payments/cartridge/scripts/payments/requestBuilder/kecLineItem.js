/* globals empty */

'use strict';

var URLUtils = require( 'dw/web/URLUtils' );
var ArrayList = require( 'dw/util/ArrayList' );
var Transaction = require( 'dw/system/Transaction' );
var Money = require( 'dw/value/Money' );

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/kec' ).LineItem;

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @return {void}
 */
function KECOrderLineItem() {
    this.item = null;
}

KECOrderLineItem.prototype = new Builder();

KECOrderLineItem.prototype.getItemPrice = function( li ) {
    return ( li.grossPrice.available && !isTaxationPolicyNet() ? li.grossPrice.value : li.netPrice.value ) * 100;
};

KECOrderLineItem.prototype.getItemProratedPrice = function( li ) {
    return li.proratedPrice.available ? li.proratedPrice.value * 100 : 0;
};

KECOrderLineItem.prototype.getItemTaxAmount = function( li ) {
    return ( isTaxationPolicyNet() ) ? 0 : ( li.tax.value * 100 );
};

KECOrderLineItem.prototype.getItemId = function( li ) {
    var id = '';

    if ( Object.prototype.hasOwnProperty.call( li, 'optionProductLineItem' ) && li.optionProductLineItem ) {
        id = li.parent.productID + '_' + li.optionID + '_' + li.optionValueID;
    } else {
        id = li.productID;
    }

    return id;
};

KECOrderLineItem.prototype.generateItemProductURL = function( li ) {
    var url = '';

    if ( li.optionProductLineItem ) {
        url = ( URLUtils.https( 'Product-Show', 'pid', li.parent.productID ).toString() );
    } else {
        url = ( URLUtils.https( 'Product-Show', 'pid', li.productID ).toString() );
    }

    return url;
};

KECOrderLineItem.prototype.generateItemImageURL = function( li ) {
    var url = '';

    if ( li.optionProductLineItem ) {
        url = ( li.parent.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
    } else {
        url = ( li.getProduct().getImage( 'small', 0 ).getImageURL( {} ).toString() );
    }

    return url;
};

KECOrderLineItem.prototype.buildItemProductAndImageUrls = function( li ) {
    this.item.productUrl = this.generateItemProductURL( li );
    this.item.imageUrl = this.generateItemImageURL( li );
};

KECOrderLineItem.prototype.getItemName = function( li ) {
    return li.productName;
};

KECOrderLineItem.prototype.build = function( li ) {
    var itemPrice = this.getItemPrice( li );
    var itemProratedPrice = this.getItemProratedPrice( li );
    var quantity = li.quantityValue;
    var currencyCode = li.getPrice().getCurrencyCode();
    var itemPriceMoney = new Money( itemPrice, currencyCode );

    this.item = new LineItem();
    this.item.lineItemReference = this.getItemId( li );
    this.item.quantity = quantity;
    this.item.name = this.getItemName( li );
    this.item.unitPrice = itemPriceMoney.divide( quantity ).getValue();
    this.item.totalAmount = isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' ) ? itemProratedPrice : itemPrice;
    this.item.totalTaxAmount = this.getItemTaxAmount( li );
    this.buildItemProductAndImageUrls( li );

    if ( isOMSEnabled ) {
        var itemObj = this.item;
        Transaction.wrap( function() {
            li.custom.klarna_oms__lineItemJSON = JSON.stringify( itemObj );
        } );
    }

    return this.item;
};

module.exports = KECOrderLineItem;
