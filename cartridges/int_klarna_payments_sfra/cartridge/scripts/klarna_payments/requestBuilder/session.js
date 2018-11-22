/* globals empty */

(function () {
    'use strict';

    var Site = require('dw/system/Site');
    var Logger = require('dw/system/Logger');

    var log = Logger.getLogger('KlarnaPaymentsSessionRequestBuilder.js');

    var Builder = require('~/cartridge/scripts/common/Builder');
    var KlarnaPaymentsSessionModel = require('~/cartridge/scripts/klarna_payments/model/request/session').KlarnaPaymentsSessionModel;
    var isEnabledPreassessmentForCountry = require('~/cartridge/scripts/util/KlarnaUtils').isEnabledPreassessmentForCountry;
    var isTaxationPolicyNet = require('~/cartridge/scripts/util/KlarnaUtils').isTaxationPolicyNet;

    var AddressRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/address');
    var OrderLineItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/orderLineItem');
    var ShipmentItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/shipmentItem');
    var PriceAdjustmentRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/priceAdjustment');
    var SalesTaxRequestRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/salesTax');
    var AdditionalCustomerInfoRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/additionalCustomerInfo');

    /**
     * KP Session Request Builder
     */
    function KlarnaPaymentsSessionRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.shipmentItemRequestBuilder = new ShipmentItemRequestBuilder();
        this.priceAdjustmentRequestBuilder = new PriceAdjustmentRequestBuilder();
        this.salesTaxRequestBuilder = new SalesTaxRequestRequestBuilder();
        this.additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();

        this.context = null;
        this.params = null;
    }

    KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();

    KlarnaPaymentsSessionRequestBuilder.prototype.getAddressRequestBuilder = function () {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderLineItemRequestBuilder = function () {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getShipmentItemRequestBuilder = function () {
        return this.shipmentItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function () {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getSalesTaxRequestBuilder = function () {
        return this.salesTaxRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function () {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setLocaleObject = function (localeObject) {
        this.localeObject = localeObject;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getLocaleObject = function () {
        return this.localeObject;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setParams = function (params) {
        this.validateParams(params);

        this.setLocaleObject(params.localeObject.custom);

        this.params = params;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.init = function (preAssement) {
        this.context = new KlarnaPaymentsSessionModel(preAssement);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setMerchantReference = function (basket) {
        this.context.merchant_reference2 = '';

        if (Site.getCurrent().getCustomPreferenceValue('merchant_reference2_mapping')) {
            try {
                this.context.merchant_reference2 = basket[Site.getCurrent().getCustomPreferenceValue('merchant_reference2_mapping')].toString();
            } catch (err) {
                log.error('merchant_reference2 was not set. Error: {0} ', err.message);
            }
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildBilling = function (basket) {
        this.context.billing_address = this.getAddressRequestBuilder().build(basket);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipping = function (basket) {
        this.context.shipping_address = this.getAddressRequestBuilder().build(basket);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildLocale = function (basket) {
        var localeObject = this.getLocaleObject();
        var currency = basket.getCurrencyCode();

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOrderLines = function (basket) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var shipments = basket.shipments;

        this.buildItems(lineItems, this);

        this.buildShipments(shipments);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderAmount = function (basket) {
        return ((basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value) * 100);
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalAmount = function (basket) {
        var orderAmount = this.getOrderAmount(basket);

        this.context.order_amount = Math.round(orderAmount);

		// Set order discount line items
        this.addPriceAdjustments(basket.priceAdjustments, null, null, this.context);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalTax = function (basket) {
        var totalTax = basket.totalTax.value * 100;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round(totalTax);

        if (isTaxationPolicyNet()) {
            salesTaxItem = this.getSalesTaxRequestBuilder().build(basket);

            this.context.order_lines.push(salesTaxItem);
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfo = function (basket) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build(basket);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOptions = function () {
        this.context.options.color_details 				= Site.getCurrent().getCustomPreferenceValue('kpColorDetails');
        this.context.options.color_button 				= Site.getCurrent().getCustomPreferenceValue('kpColorButton');
        this.context.options.color_button_text 			= Site.getCurrent().getCustomPreferenceValue('kpColorButtonText');
        this.context.options.color_checkbox 			= Site.getCurrent().getCustomPreferenceValue('kpColorCheckbox');
        this.context.options.color_checkbox_checkmark 	= Site.getCurrent().getCustomPreferenceValue('kpColorCheckboxCheckmark');
        this.context.options.color_header 				= Site.getCurrent().getCustomPreferenceValue('kpColorHeader');
        this.context.options.color_link 				= Site.getCurrent().getCustomPreferenceValue('kpColorLink');
        this.context.options.color_border 				= Site.getCurrent().getCustomPreferenceValue('kpColorBorder');
        this.context.options.color_border_selected 		= Site.getCurrent().getCustomPreferenceValue('kpColorBorderSelected');
        this.context.options.color_text 				= Site.getCurrent().getCustomPreferenceValue('kpColorText');
        this.context.options.color_text_secondary 		= Site.getCurrent().getCustomPreferenceValue('kpColorTextSecondary');
        this.context.options.radius_border 				= Site.getCurrent().getCustomPreferenceValue('kpRadiusBorder');

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItem = function (li) {
        var item = this.getOrderLineItemRequestBuilder().build(li);

        return item;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItems = function (items) {
        var i = 0;
        var li = {};
        var newItem = {};

        while (i < items.length) {
            li = items[i];

			// Add product-specific shipping line adjustments
            if (!empty(li.shippingLineItem)) {
                this.addPriceAdjustments(li.shippingLineItem.priceAdjustments.toArray(), li.productID, null);
            }

            if (!empty(li.priceAdjustments) && li.priceAdjustments.length > 0) {
                this.addPriceAdjustments(li.priceAdjustments.toArray(), li.productID, li.optionID);
            }

            newItem = this.buildItem(li);

            this.context.order_lines.push(newItem);

            i += 1;
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipments = function (shipments) {
        var shipment = {};
        var shippingLineItem = {};

        for (var i = 0; i < shipments.length; i++) {
            shipment = shipments[i];

            if (!empty(shipment.shippingMethod) && !empty(shipment.shippingAddress)) {
                shippingLineItem = this.getShipmentItemRequestBuilder().build(shipment);

                this.addPriceAdjustments(shipment.shippingPriceAdjustments.toArray(), null, null);

                this.context.order_lines.push(shippingLineItem);
            }
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.addPriceAdjustments = function (adjusments, pid, oid) {
        var adj = {};
        var adjustment = {};
        var priceAdjustmentRequestBuilder = this.getPriceAdjustmentRequestBuilder();

        for (var i = 0; i < adjusments.length; i++) {
            adj = adjusments[i];

            priceAdjustmentRequestBuilder.setProductId(pid);
            priceAdjustmentRequestBuilder.setObjectId(oid);

            adjustment = priceAdjustmentRequestBuilder.build(adj);

            this.context.order_lines.push(adjustment);
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.isLocaleObjectParamsValid = function (localeObject) {
        return (!empty(localeObject.custom.country) || !empty(localeObject.custom.klarnaLocale));
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.isParamsValid = function (params) {
        return (!empty(params.basket) && !empty(params.localeObject) && this.isLocaleObjectParamsValid(params.localeObject));
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.validateParams = function (params) {
        if (empty(params) || !this.isParamsValid(params)) {
            throw new Error('Error when generating KlarnaPaymentsSessionRequestBuilder. Not valid params.');
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.build = function () {
        var basket = this.params.basket;
        var preAssement = isEnabledPreassessmentForCountry(this.getLocaleObject().country);
        var kpAttachmentsPreferenceValue = Site.getCurrent().getCustomPreferenceValue('kpAttachments');

        this.init(preAssement);

        this.setMerchantReference(basket);

        this.buildLocale(basket);

        if (preAssement) {
            this.buildBilling(basket);
            this.buildShipping(basket);
        }

        this.buildOrderLines(basket);
        this.buildTotalAmount(basket);
        this.buildTotalTax(basket);

        if (kpAttachmentsPreferenceValue) {
            this.buildAdditionalCustomerInfo(basket);
        }

        this.buildOptions();

        return this.context;
    };

    module.exports = KlarnaPaymentsSessionRequestBuilder;
}());
