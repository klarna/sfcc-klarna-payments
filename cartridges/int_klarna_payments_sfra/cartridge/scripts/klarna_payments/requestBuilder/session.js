(function () {
    'use strict';

    var Site = require('dw/system/Site');
    var Logger = require('dw/system/Logger');
    var TaxMgr = require('dw/order/TaxMgr');
    var ArrayList = require('dw/util/ArrayList');

    var ShippingLocation = require('dw/order/ShippingLocation');
    var Builder = require('~/cartridge/scripts/common/Builder');
    var ORDER_LINE_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').ORDER_LINE_TYPE;
    var CONTENT_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').CONTENT_TYPE;
    var KlarnaPaymentsSessionModel = require('~/cartridge/scripts/klarna_payments/model/request/session').KlarnaPaymentsSessionModel;
    var LineItem = require('~/cartridge/scripts/klarna_payments/model/request/session').LineItem;
    var log = Logger.getLogger('KlarnaPaymentsSessionRequestBuilder.js');
    var empty = require('~/cartridge/scripts/util/KlarnaUtils').empty;
    var isEnabledPreassessmentForCountry = require('~/cartridge/scripts/util/KlarnaUtils').isEnabledPreassessmentForCountry;

    var AddressRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/address');
    var OrderLineItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/orderLineItem');

    function KlarnaPaymentsSessionRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.context = null;
        this.params = null;
    }

    KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();
    KlarnaPaymentsSessionRequestBuilder.prototype.get = function () {
        return this.context;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getAddressRequestBuilder = function () {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderLineItemRequestBuilder = function () {
        return this.orderLineItemRequestBuilder;
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

	/*
	    Build request here
	*/
    KlarnaPaymentsSessionRequestBuilder.prototype.buildRequest = function () {
        var basket = this.params.basket;
        var preAssement = isEnabledPreassessmentForCountry(this.getLocaleObject().country);
        var requestBodyObject = {};

        requestBodyObject = this.init(preAssement);

        this.setMerchantReference(basket);

        this.buildLocale(basket);

        if (preAssement) {
            this.buildBilling(basket);
            this.buildShipping(basket);
        }

        this.buildOrderLines(basket);
        this.buildTotalAmount(basket);
        this.buildTotalTax(basket);
        this.buildAdditionalCustomerInfo(basket);
        this.buildOptions();

        return requestBodyObject;
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
        var giftCertificates = basket.getGiftCertificateLineItems().toArray();
        var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
        var shipments = basket.shipments;

        this.buildItems(lineItems, this.context);

        if (giftCertificates.length > 0) {
            this.buildItems(giftCertificates, this.context);
        }

        if (giftCertificatePIs.length > 0) {
            this.buildItemsGiftCertificatePIs(giftCertificatePIs, this.context);
        }

        this.buildShipments(shipments, this.context);

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderAmount = function (basket) {
        var gcTotalAmount = this.getGCtotalAmount(basket);

        return ((basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value) * 100) - gcTotalAmount;
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
        var usTotalTax = 0;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round(totalTax);

        if (this.isTaxationPolicyNet()) {
            usTotalTax = Math.round((basket.totalTax.available) ? basket.totalTax.value * 100 : 0);
            salesTaxItem = new LineItem();
            salesTaxItem.quantity = 1;
            salesTaxItem.type = ORDER_LINE_TYPE.SALES_TAX;
            salesTaxItem.name = 'Sales Tax';
            salesTaxItem.reference = 'Sales Tax';
            salesTaxItem.unit_price = usTotalTax;
            salesTaxItem.tax_rate = 0;
            salesTaxItem.total_amount = usTotalTax;
            salesTaxItem.total_tax_amount = 0;

            this.context.order_lines.push(salesTaxItem);
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfo = function (basket) {
        if (Site.getCurrent().getCustomPreferenceValue('kpAttachments')) {
            this.context.attachment = {};
            this.context.attachment.content_type = CONTENT_TYPE;
            this.context.attachment.body = this.buildAdditionalCustomerInfoBody(basket);
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerPurchaseHistory = function (customer) {
        var purchaseHistoryFull = [{}];
        purchaseHistoryFull[0].unique_account_identifier = customer.ID;
        purchaseHistoryFull[0].payment_option = 'other';

        if (customer.getActiveData()) {
            purchaseHistoryFull[0].number_paid_purchases = !empty(customer.activeData.orders) ? customer.activeData.orders : 0;
            purchaseHistoryFull[0].total_amount_paid_purchases = !empty(customer.activeData.orderValue) ? customer.activeData.orderValue : 0;
            purchaseHistoryFull[0].date_of_last_paid_purchase = !empty(customer.activeData.lastOrderDate) ? customer.activeData.lastOrderDate.toISOString().slice(0, -5) + 'Z' : '';
            purchaseHistoryFull[0].date_of_first_paid_purchase = '';
        }

        return purchaseHistoryFull;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfoBody = function (basket) {
        var customer = basket.getCustomer();
        var body = {};

        body.customer_account_info = new Array({});

        if (customer.registered) {
            body.customer_account_info[0].unique_account_identifier = customer.profile.customerNo;
            body.customer_account_info[0].account_registration_date = !empty(customer.profile.creationDate) ? customer.profile.creationDate.toISOString().slice(0, -5) + 'Z' : '';
            body.customer_account_info[0].account_last_modified = !empty(customer.profile.lastModified) ? customer.profile.lastModified.toISOString().slice(0, -5) + 'Z' : '';
        }

        body.purchase_history_full = this.buildAdditionalCustomerPurchaseHistory(customer);

        return JSON.stringify(body);
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOptions = function ()	{
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
        var item = this.orderLineItemRequestBuilder.build(li);

        return item;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItems = function (items, context) {
        var i = 0;
        var li = {};

        while (i < items.length) {
            li = items[i];

			// Add product-specific shipping line adjustments
            if (!empty(li.shippingLineItem)) {
                this.addPriceAdjustments(li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, context);
            }

            if (!empty(li.priceAdjustments) && li.priceAdjustments.length > 0) {
                this.addPriceAdjustments(li.priceAdjustments.toArray(), li.productID, li.optionID, context);
            }

            context.order_lines.push(this.buildItem(li));

            i += 1;
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItemsGiftCertificatePIs = function (items, context) {
        var li = [];
        var item = {};
        var paymentTransaction = {};
        var i = 0;

        for (i = 0; i < items.length; i++) {
            li = items[i];
            paymentTransaction = li.getPaymentTransaction();

            item = new LineItem();
            item.quantity = 1;
            item.type = ORDER_LINE_TYPE.GIFT_CERTIFICATE_PI;
            item.name = 'Gift Certificate';
            item.reference = li.getMaskedGiftCertificateCode();
            item.unit_price = paymentTransaction.getAmount() * 100 * (-1);
            item.tax_rate = 0;
            item.total_amount = paymentTransaction.getAmount() * 100 * (-1);
            item.total_tax_amount = 0;

            context.order_lines.push(item);
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getGCtotalAmount = function (basket) {
        var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
        var gcTotalAmount = 0;
        var i = 0;

        if (giftCertificatePIs.length > 0) {
            for (i = 0; i < giftCertificatePIs.length; i++) {
                gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;
            }
        }

        return gcTotalAmount;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.calculateShippingTotalTaxAmount = function (shipment) {
        return (this.isTaxationPolicyNet()) ? 0 : Math.round(shipment.shippingTotalTax.value * 100);
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipmentItem = function (shipment) {
        var shipmentTaxRate = this.getShipmentTaxRate(shipment);
        var shipmentUnitPrice = this.getShipmentUnitPrice(shipment);

        var shippingLineItem = new LineItem();
        shippingLineItem.quantity = 1;
        shippingLineItem.type = ORDER_LINE_TYPE.SHIPPING_FEE;
        shippingLineItem.name = shipment.shippingMethod.displayName.replace(/[^\x00-\x7F]/g, '');
        shippingLineItem.reference = shipment.shippingMethod.ID;
        shippingLineItem.unit_price = Math.round(shipmentUnitPrice);
        shippingLineItem.tax_rate = Math.round(shipmentTaxRate);
        shippingLineItem.total_amount = shippingLineItem.unit_price;
        shippingLineItem.total_tax_amount = this.calculateShippingTotalTaxAmount(shipment);

        return shippingLineItem;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.isTaxationPolicyNet = function () {
        return (this.getLocaleObject().country === 'US');
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getShipmentTaxRate = function (shipment) {
        var shipmentTaxRate = 0;

        if (!empty(shipment.shippingMethod) && !empty(shipment.shippingMethod.taxClassID) && !empty(shipment.shippingAddress)) {
            shipmentTaxRate = (this.isTaxationPolicyNet()) ? 0 : (TaxMgr.getTaxRate(shipment.shippingMethod.taxClassID, TaxMgr.getTaxJurisdictionID(new ShippingLocation(shipment.shippingAddress)))) * 10000;
        }

        return shipmentTaxRate;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getShipmentUnitPrice = function (shipment) {
        var shipmentUnitPrice = (shipment.shippingTotalGrossPrice.available && !this.isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value) * 100;

        return shipmentUnitPrice;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipments = function (shipments, context) {
        var shipment = {};
        var shippingLineItem = {};

        for (var i = 0; i < shipments.length; i++) {
            shipment = shipments[i];

            if (!empty(shipment.shippingMethod)) {
                shippingLineItem = this.buildShipmentItem(shipment);

                this.addPriceAdjustments(shipment.shippingPriceAdjustments.toArray(), null, null, context);

                context.order_lines.push(shippingLineItem);
            }
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentPromoName = function (adj) {
        var promoName = !empty(adj.promotion) && !empty(adj.promotion.name) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;

        promoName = promoName.replace(/[^\x00-\x7F]/g, '');

        return promoName;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentPromoId = function (adj, pid, oid) {
        var promoId = adj.promotionID;

        if (!empty(pid)) {
            promoId = pid + '_' + promoId;
        } else if (!empty(oid)) {
            promoId = oid + '_' + promoId;
        }

        return promoId;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentMerchantData = function (adj) {
        return (adj.couponLineItem ? adj.couponLineItem.couponCode : '');
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentTaxRate = function (adj) {
        return (this.isTaxationPolicyNet()) ? 0 : Math.round(adj.taxRate * 10000);
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentTotalTaxAmount = function (adj) {
        return (this.isTaxationPolicyNet()) ? 0 : Math.round(adj.tax.value * 100);
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentUnitPrice = function (adj) {
        return (adj.grossPrice.available && !this.isTaxationPolicyNet() ? adj.grossPrice.value : adj.netPrice.value) * 100;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.addPriceAdjustments = function (adjusments, pid, oid, context) {
        var adjusmentPrice = 0;
        var adj = {};
        var adjustment = {};

        for (var i = 0; i < adjusments.length; i++) {
            adj = adjusments[i];
            adjustment = new LineItem();
            adjusmentPrice = this.getPriceAdjustmentUnitPrice(adj);

            adjustment.quantity = 1;
            adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
            adjustment.name = this.getPriceAdjustmentPromoName(adj);
            adjustment.reference = this.getPriceAdjustmentPromoId(adj);
            adjustment.unit_price = Math.round(adjusmentPrice);
            adjustment.merchant_data = this.getPriceAdjustmentMerchantData(adj);
            adjustment.tax_rate = this.getPriceAdjustmentTaxRate(adj);
            adjustment.total_amount = adjustment.unit_price;
            adjustment.total_tax_amount = this.getPriceAdjustmentTotalTaxAmount(adj);

            context.order_lines.push(adjustment);
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

    module.exports = KlarnaPaymentsSessionRequestBuilder;
}());
