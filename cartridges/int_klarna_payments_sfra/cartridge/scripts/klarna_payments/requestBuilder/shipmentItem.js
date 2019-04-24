/* globals empty */

'use strict';

var TaxMgr = require('dw/order/TaxMgr');
var ShippingLocation = require('dw/order/ShippingLocation');

var Builder = require('*/cartridge/scripts/klarna_payments/Builder');
var LineItem = require('*/cartridge/scripts/klarna_payments/model/request/session').LineItem;

var isTaxationPolicyNet = require('*/cartridge/scripts/util/KlarnaUtils').isTaxationPolicyNet;

var ORDER_LINE_TYPE = require('*/cartridge/scripts/util/KlarnaPaymentsConstants.js').ORDER_LINE_TYPE;

/**
 * KP Order Line Item Builder
 */
function ShipmentItem() {
    this.item = null;
}

ShipmentItem.prototype = new Builder();

ShipmentItem.prototype.calculateShippingTotalTaxAmount = function (shipment) {
    return (isTaxationPolicyNet()) ? 0 : Math.round(shipment.shippingTotalTax.value * 100);
};

ShipmentItem.prototype.getShipmentTaxRate = function (shipment) {
    var shipmentTaxRate = 0;
    var taxJurisdictionId = '';

    if (!empty(shipment.shippingMethod) && !empty(shipment.shippingMethod.taxClassID)) {
        if (!empty(shipment.shippingAddress)) {
            taxJurisdictionId = TaxMgr.getTaxJurisdictionID(new ShippingLocation(shipment.shippingAddress));
        } else {
            taxJurisdictionId = TaxMgr.getDefaultTaxJurisdictionID();
        }

        var taxRate = TaxMgr.getTaxRate(shipment.shippingMethod.taxClassID, taxJurisdictionId);

        shipmentTaxRate = (isTaxationPolicyNet()) ? 0 : (taxRate) * 10000;
    }

    return shipmentTaxRate;
};

ShipmentItem.prototype.getShipmentUnitPrice = function (shipment) {
    var shipmentUnitPrice = (shipment.shippingTotalGrossPrice.available && !isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value) * 100;

    return shipmentUnitPrice;
};

ShipmentItem.prototype.build = function (shipment) {
    var shipmentTaxRate = this.getShipmentTaxRate(shipment);
    var shipmentUnitPrice = Math.round(this.getShipmentUnitPrice(shipment));

    this.item = new LineItem();
    this.item.quantity = 1;
    this.item.type = ORDER_LINE_TYPE.SHIPPING_FEE;
    this.item.name = shipment.shippingMethod.displayName;
    this.item.reference = shipment.shippingMethod.ID;
    this.item.unit_price = shipmentUnitPrice;
    this.item.tax_rate = Math.round(shipmentTaxRate);
    this.item.total_amount = shipmentUnitPrice;

    this.item.total_tax_amount = this.calculateShippingTotalTaxAmount(shipment);

    return this.item;
};

module.exports = ShipmentItem;
