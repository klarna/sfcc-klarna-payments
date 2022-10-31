/* globals empty */

'use strict';
var Transaction = require( 'dw/system/Transaction' );

var TaxMgr = require( 'dw/order/TaxMgr' );
var ShippingLocation = require( 'dw/order/ShippingLocation' );

var Builder = require( '*/cartridge/scripts/payments/builder' );
var LineItem = require( '*/cartridge/scripts/payments/model/request/session' ).LineItem;

var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();

var ORDER_LINE_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 * @return {void}
 */
function ShipmentItem() {
    var AddressRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/address' );
    this.item = null;
    this.addressRequestBuilder = new AddressRequestBuilder();
    this.isMerchantDataAvailable = true;
}

ShipmentItem.prototype = new Builder();


ShipmentItem.prototype.setMerchantDataAvailable = function( isMerchantDataAvailable ) {
    this.isMerchantDataAvailable = isMerchantDataAvailable;
};

ShipmentItem.prototype.getAddressRequestBuilder = function() {
    return this.addressRequestBuilder;
};
ShipmentItem.prototype.calculateShippingTotalTaxAmount = function( shipment ) {
    return ( isTaxationPolicyNet() ) ? 0 : Math.round( shipment.shippingTotalTax.value * 100 );
};

ShipmentItem.prototype.getShipmentTaxRate = function( shipment ) {
    var shipmentTaxRate = 0;
    var taxJurisdictionId = '';

    if ( !empty( shipment.shippingMethod ) && !empty( shipment.shippingMethod.taxClassID ) ) {
        if ( !empty( shipment.shippingAddress ) ) {
            taxJurisdictionId = TaxMgr.getTaxJurisdictionID( new ShippingLocation( shipment.shippingAddress ) );
        } else {
            taxJurisdictionId = TaxMgr.getDefaultTaxJurisdictionID();
        }

        var taxRate = TaxMgr.getTaxRate( shipment.shippingMethod.taxClassID, taxJurisdictionId );

        shipmentTaxRate = ( isTaxationPolicyNet() ) ? 0 : ( taxRate ) * 10000;
    }

    return shipmentTaxRate;
};

ShipmentItem.prototype.getShipmentUnitPrice = function( shipment ) {
    var shipmentUnitPrice = ( shipment.shippingTotalGrossPrice.available && !isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value ) * 100;

    return shipmentUnitPrice;
};

ShipmentItem.prototype.getShipmentAdjustedPrice = function( shipment ) {
    var shipmentAdjustedPrice = ( shipment.adjustedShippingTotalGrossPrice.available && !isTaxationPolicyNet() ? shipment.adjustedShippingTotalGrossPrice.value : shipment.adjustedShippingTotalNetPrice.value ) * 100;

    return shipmentAdjustedPrice;
};

ShipmentItem.prototype.getShipmentProductIds = function( shipment ) {
    var productIds = [];

    var shipmentLineItemsIterator = shipment.getProductLineItems().iterator();

    while ( shipmentLineItemsIterator.hasNext() ) {
        var shipmentLineItem = shipmentLineItemsIterator.next();

        productIds.push( shipmentLineItem.productID );
    }

    return productIds;
};

ShipmentItem.prototype.buildMerchantData = function( shipment ) {
    var merchantDataStr = JSON.stringify( {
        products: this.getShipmentProductIds( shipment ),
        address: this.getAddressRequestBuilder().buildFlat( shipment.shippingAddress )
    } );

    if ( merchantDataStr.length > 255 ) {
        merchantDataStr = merchantDataStr.substr( 0, 255 - 3 ) + '...';
    }

    return merchantDataStr;
};

ShipmentItem.prototype.build = function( shipment ) {
    var shipmentTaxRate = this.getShipmentTaxRate( shipment );
    var shipmentUnitPrice = Math.round( this.getShipmentUnitPrice( shipment ) );
    var shipmentAdjustedPrice = Math.round( this.getShipmentAdjustedPrice( shipment ) );

    this.item = new LineItem();
    this.item.quantity = 1;
    this.item.type = ORDER_LINE_TYPE.SHIPPING_FEE;
    this.item.name = shipment.shippingMethod.displayName;
    this.item.reference = shipment.shippingMethod.ID;
    this.item.unit_price = shipmentUnitPrice;
    this.item.tax_rate = Math.round( shipmentTaxRate );
    this.item.total_amount = isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' ) ? shipmentAdjustedPrice : shipmentUnitPrice;

    if ( isOMSEnabled || ( !isTaxationPolicyNet() && discountTaxationMethod === 'adjustment' && shipmentUnitPrice !== shipmentAdjustedPrice ) ) {
        var discountAmount = shipmentUnitPrice - shipmentAdjustedPrice;
        this.item.total_discount_amount = Math.round( discountAmount );
    }

    if ( this.isMerchantDataAvailable && !empty( shipment.shippingAddress ) ) {
        this.item.merchant_data = this.buildMerchantData( shipment );
    }

    this.item.total_tax_amount = this.calculateShippingTotalTaxAmount( shipment );

    if ( isOMSEnabled ) {
        var itemObj = this.item;
        Transaction.wrap( function() {
            shipment.custom.lineItemJSON = JSON.stringify( itemObj );
        } );
    }

    return this.item;
};

module.exports = ShipmentItem;
