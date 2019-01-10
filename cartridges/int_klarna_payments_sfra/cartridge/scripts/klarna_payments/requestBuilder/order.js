/* globals empty */

(function () {
    'use strict';

    var URLUtils = require('dw/web/URLUtils');
    var Site = require('dw/system/Site');
    var Logger = require('dw/system/Logger');
    var HookMgr = require('dw/system/HookMgr');

    var log = Logger.getLogger('KlarnaPaymentsOrderRequestBuilder.js');

    var Builder = require('~/cartridge/scripts/common/Builder');
    var CONTENT_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').CONTENT_TYPE;

    var KlarnaPaymentsOrderModel = require('~/cartridge/scripts/klarna_payments/model/request/order').KlarnaPaymentsOrderModel;

    var AddressRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/address');
    var OrderLineItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/orderLineItem');
    var ShipmentItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/shipmentItem');
    var PriceAdjustmentRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/priceAdjustment');
    var SalesTaxRequestRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/salesTax');
    var AdditionalCustomerInfoRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/additionalCustomerInfo');
    var OptionsRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/options');

    /**
     * KP Order Request Builder
     */
    function KlarnaPaymentsOrderRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.shipmentItemRequestBuilder = new ShipmentItemRequestBuilder();
        this.priceAdjustmentRequestBuilder = new PriceAdjustmentRequestBuilder();
        this.salesTaxRequestBuilder = new SalesTaxRequestRequestBuilder();
        this.additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();
        this.optionsRequestBuilder = new OptionsRequestBuilder();

        this.context = null;
        this.localeObject = null;
        this.params = null;
    }

    KlarnaPaymentsOrderRequestBuilder.prototype = new Builder();

    KlarnaPaymentsOrderRequestBuilder.prototype.getAddressRequestBuilder = function () {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOrderLineItemRequestBuilder = function () {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getShipmentItemRequestBuilder = function () {
        return this.shipmentItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function () {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getSalesTaxRequestBuilder = function () {
        return this.salesTaxRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function () {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOptionsRequestBuilder = function () {
        return this.optionsRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setParams = function (params) {
        this.validateParams(params);

        this.setLocaleObject(params.localeObject.custom);

        this.params = params;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setLocaleObject = function (localeObject) {
        this.localeObject = localeObject;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getLocaleObject = function () {
        return this.localeObject;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.init = function () {
        this.context = new KlarnaPaymentsOrderModel();

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setMerchantReference = function (order) {
        this.context.merchant_reference1 = order.orderNo;
        this.context.merchant_reference2 = '';

        if (Site.getCurrent().getCustomPreferenceValue('merchant_reference2_mapping')) {
            try {
                this.context.merchant_reference2 = order[Site.getCurrent().getCustomPreferenceValue('merchant_reference2_mapping')].toString();
            } catch (err) {
                log.error('merchant_reference2 was not set. Error: {0} ', err.message);
            }
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildBilling = function (order) {
        var billingAddress = order.getBillingAddress();
        if (billingAddress === null) {
            return this;
        }

        this.context.billing_address = this.getAddressRequestBuilder().build(billingAddress);
        this.context.billing_address.email = order.customerEmail || '';

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipping = function (order) {
        // get default shipment shipping address
        var shippingAddress = order.getShipments().iterator().next().getShippingAddress();

        if (shippingAddress === null || shippingAddress.address1 === null) {
            delete this.context.shipping_address;
            return this;
        }

        this.context.shipping_address = this.getAddressRequestBuilder().build(shippingAddress);
        this.context.shipping_address.email = order.customerEmail;

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildLocale = function (order) {
        var localeObject = this.getLocaleObject();
        var currency = order.getCurrencyCode();

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildOrderLines = function (order) {
        var lineItems = order.getAllProductLineItems().toArray();
        var shipments = order.shipments;

        this.buildItems(lineItems, this.context);

        this.buildShipments(shipments, this.context);

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOrderAmount = function (order) {
        var orderAmount = 0;

        if (order.totalGrossPrice.available) {
            orderAmount = order.totalGrossPrice.value * 100;
        } else {
            orderAmount = order.totalNetPrice.value * 100;
        }

        return orderAmount;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalAmount = function (order) {
        var orderAmount = this.getOrderAmount(order);

        this.context.order_amount = Math.round(orderAmount);

		// Set order discount line items
        this.addPriceAdjustments(order.priceAdjustments, null, null, this.context);

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isTaxationPolicyNet = function () {
        return (this.getLocaleObject().country === 'US');
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalTax = function (order) {
        var totalTax = order.totalTax.value * 100;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round(totalTax);

        if (this.isTaxationPolicyNet()) {
            salesTaxItem = this.getSalesTaxRequestBuilder().build(order);

            this.context.order_lines.push(salesTaxItem);
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildAdditionalCustomerInfo = function (order) {
        if (Site.getCurrent().getCustomPreferenceValue('kpAttachments') && HookMgr.hasHook('extra.merchant.data')) {
            this.context.attachment = {};
            this.context.attachment.content_type = CONTENT_TYPE;
            this.context.attachment.body = 	HookMgr.callHook('extra.merchant.data', 'BuildEMD', {
                LineItemCtnr: order
            });
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildOptions = function () {
        var currentSite = Site.getCurrent();

        var preferences = {
            kpColorDetails: currentSite.getCustomPreferenceValue('kpColorDetails'),
            kpColorButton: currentSite.getCustomPreferenceValue('kpColorButton'),
            kpColorButtonText: currentSite.getCustomPreferenceValue('kpColorButtonText'),
            kpColorCheckbox: currentSite.getCustomPreferenceValue('kpColorCheckbox'),
            kpColorCheckboxCheckmark: currentSite.getCustomPreferenceValue('kpColorCheckboxCheckmark'),
            kpColorHeader: currentSite.getCustomPreferenceValue('kpColorHeader'),
            kpColorLink: currentSite.getCustomPreferenceValue('kpColorLink'),
            kpColorBorder: currentSite.getCustomPreferenceValue('kpColorBorder'),
            kpColorBorderSelected: currentSite.getCustomPreferenceValue('kpColorBorderSelected'),
            kpColorText: currentSite.getCustomPreferenceValue('kpColorText'),
            kpColorTextSecondary: currentSite.getCustomPreferenceValue('kpColorTextSecondary'),
            kpRadiusBorder: currentSite.getCustomPreferenceValue('kpRadiusBorder')
        };

        var options = this.getOptionsRequestBuilder().build(preferences);

        this.context.options = options;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildMerchantInformation = function ()	{
        var country = this.getLocaleObject().country;

        this.context.merchant_urls.confirmation = URLUtils.https('KlarnaPayments-Confirmation', 'klarna_country', country).toString();
        this.context.merchant_urls.notification = URLUtils.https('KlarnaPayments-Notification', 'klarna_country', country).toString();

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildItem = function (li) {
        var item = this.orderLineItemRequestBuilder.build(li);

        return item;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildItems = function (items, context) {
        var i = 0;
        var li = {};
        var item = {};

        while (i < items.length) {
            li = items[i];

			// Add product-specific shipping line adjustments
            if (!empty(li.shippingLineItem)) {
                this.addPriceAdjustments(li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, context);
            }

            if (!empty(li.priceAdjustments) && li.priceAdjustments.length > 0) {
                this.addPriceAdjustments(li.priceAdjustments.toArray(), li.productID, li.optionID, context);
            }

            item = this.buildItem(li);

            context.order_lines.push(item);

            i += 1;
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildItemsGiftCertificatePIs = function (items, country, context)	{
        var li = [];
        var newItem = {};
        var i = 0;

        for (i = 0; i < items.length; i++) {
            li = items[i];

            newItem = this.getGiftCertificatePIRequestBuilder().build(li);

            context.order_lines.push(newItem);
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipments = function (shipments, context) {
        var shipment = {};
        var shippingLineItem = {};

        for (var i = 0; i < shipments.length; i++) {
            shipment = shipments[i];

            if (!empty(shipment.shippingMethod) && !empty(shipment.shippingAddress)) {
                shippingLineItem = this.getShipmentItemRequestBuilder().build(shipment);

                this.addPriceAdjustments(shipment.shippingPriceAdjustments.toArray(), null, null, context);

                context.order_lines.push(shippingLineItem);
            }
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.addPriceAdjustments = function (adjusments, pid, oid, context) {
        var adj = {};
        var adjustment = {};
        var priceAdjustmentRequestBuilder = this.getPriceAdjustmentRequestBuilder();

        for (var i = 0; i < adjusments.length; i++) {
            adj = adjusments[i];

            adjustment = priceAdjustmentRequestBuilder.build(adj);

            context.order_lines.push(adjustment);
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isValidLocaleObjectParams = function (localeObject) {
        return (!empty(localeObject.custom.country) || !empty(localeObject.custom.klarnaLocale));
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isValidParams = function (params) {
        return (!empty(params.order) && !empty(params.localeObject) && this.isValidLocaleObjectParams(params.localeObject));
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.validateParams = function (params) {
        if (empty(params) || !this.isValidParams(params)) {
            throw new Error('Error when generating KlarnaPaymentsOrderRequestBuilder. Not valid params.');
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.build = function () {
        var order = this.params.order;

        this.init()
			.setMerchantReference(order)
			.buildLocale(order)
			.buildBilling(order)
			.buildShipping(order)
			.buildOrderLines(order)
			.buildTotalAmount(order)
			.buildTotalTax(order)
			.buildAdditionalCustomerInfo(order)
			.buildOptions()
			.buildMerchantInformation(order);

        return this.context;
    };

    module.exports = KlarnaPaymentsOrderRequestBuilder;
}());
