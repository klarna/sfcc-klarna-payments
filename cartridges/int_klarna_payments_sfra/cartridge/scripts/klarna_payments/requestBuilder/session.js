/* globals empty */

(function () {
    'use strict';

    var Site = require('dw/system/Site');
    var Logger = require('dw/system/Logger');

    var log = Logger.getLogger('KlarnaPaymentsSessionRequestBuilder.js');

    var Builder = require('*/cartridge/scripts/klarna_payments/Builder');
    var KlarnaPaymentsSessionModel = require('*/cartridge/scripts/klarna_payments/model/request/session').KlarnaPaymentsSessionModel;
    var isEnabledPreassessmentForCountry = require('*/cartridge/scripts/util/KlarnaUtils').isEnabledPreassessmentForCountry;
    var isTaxationPolicyNet = require('*/cartridge/scripts/util/KlarnaUtils').isTaxationPolicyNet;

    var AddressRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/address');
    var OrderLineItemRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/orderLineItem');
    var ShipmentItemRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/shipmentItem');
    var PriceAdjustmentRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/priceAdjustment');
    var SalesTaxRequestRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/salesTax');
    var AdditionalCustomerInfoRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/additionalCustomerInfo');
    var OptionsRequestBuilder = require('*/cartridge/scripts/klarna_payments/requestBuilder/options');

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
        this.optionsRequestBuilder = new OptionsRequestBuilder();

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

    KlarnaPaymentsSessionRequestBuilder.prototype.getOptionsRequestBuilder = function () {
        return this.optionsRequestBuilder;
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

        this.getShipmentItemRequestBuilder().setMerchantDataAvailable(preAssement);

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
        var currentCustomer = basket.getCustomer();
        var customerPreferredAddress = {};

        this.context.billing_address.email = basket.customerEmail || '';

        if (empty(currentCustomer) || empty(currentCustomer.profile)) {
            var billingAddress = basket.getShipments().iterator().next().getShippingAddress();
            if (empty(billingAddress)) {
                return this;
            }

            this.context.billing_address = this.getAddressRequestBuilder().build(billingAddress);
            this.context.billing_address.email = basket.customerEmail || '';

            return this;
        }

        this.context.billing_address.phone = currentCustomer.profile.phoneHome;
        this.context.billing_address.given_name = currentCustomer.profile.firstName;
        this.context.billing_address.family_name = currentCustomer.profile.lastName;

        customerPreferredAddress = currentCustomer.addressBook.preferredAddress;

        if (!empty(customerPreferredAddress)) {
            this.context.billing_address = this.getAddressRequestBuilder().build(customerPreferredAddress);
        }

        this.context.billing_address.email = currentCustomer.profile.email;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipping = function (basket) {
        var currentCustomer = basket.getCustomer();
        var customerPreferredAddress = {};

        this.context.shipping_address.email = basket.customerEmail || '';

        if (empty(currentCustomer) || empty(currentCustomer.profile)) {
            // get default shipment shipping address
            var shippingAddress = basket.getShipments().iterator().next().getShippingAddress();
            if (empty(shippingAddress)) {
                delete this.context.shipping_address;
                return this;
            }

            this.context.shipping_address = this.getAddressRequestBuilder().build(shippingAddress);

            return this;
        }

        this.context.shipping_address.email = '';
        this.context.shipping_address.phone = currentCustomer.profile.phoneHome;
        this.context.shipping_address.given_name = currentCustomer.profile.firstName;
        this.context.shipping_address.family_name = currentCustomer.profile.lastName;

        customerPreferredAddress = currentCustomer.addressBook.preferredAddress;

        if (!empty(customerPreferredAddress)) {
            this.context.shipping_address = this.getAddressRequestBuilder().build(customerPreferredAddress);
        }

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
        this.buildItems(lineItems, this);

        var shipments = basket.shipments;
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

            if (!empty(shipment.shippingMethod)) {
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
