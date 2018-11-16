(function () {
    'use strict';

    var URLUtils = require('dw/web/URLUtils');
    var Site = require('dw/system/Site');
    var Logger = require('dw/system/Logger');
    var TaxMgr = require('dw/order/TaxMgr');
    var HookMgr = require('dw/system/HookMgr');
    var ShippingLocation = require('dw/order/ShippingLocation');

    var Builder = require('~/cartridge/scripts/common/Builder');
    var ORDER_LINE_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').ORDER_LINE_TYPE;
    var CONTENT_TYPE = require('~/cartridge/scripts/util/KlarnaPaymentsConstants.js').CONTENT_TYPE;
    var log = Logger.getLogger('KlarnaPaymentsOrderRequestBuilder.js');
    var empty = require('~/cartridge/scripts/util/KlarnaUtils').empty;

    var KlarnaPaymentsOrderModel = require('~/cartridge/scripts/klarna_payments/model/request/order').KlarnaPaymentsOrderModel;
    var LineItem = require('~/cartridge/scripts/klarna_payments/model/request/order').LineItem;
    var AddressRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/address');
    var OrderLineItemRequestBuilder = require('~/cartridge/scripts/klarna_payments/requestBuilder/orderLineItem');

    function KlarnaPaymentsOrderRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.context = null;
        this.localeObject = null;
        this.params = null;
    }

    KlarnaPaymentsOrderRequestBuilder.prototype = new Builder();
    KlarnaPaymentsOrderRequestBuilder.prototype.get = function () {
        return this.context;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getAddressRequestBuilder = function () {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOrderLineItemRequestBuilder = function () {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setParams = function (params) {
        this.validateParams(params);

        this.setLocaleObject(params.localeObject.custom);

        this.params = params;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildRequest = function () {
        var order = this.params.order;

        var requestBodyObject = this.init()
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

        return requestBodyObject;
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

    KlarnaPaymentsOrderRequestBuilder.prototype.buildBilling = function (basket) {
        this.context.billing_address = this.getAddressRequestBuilder().build(basket);

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipping = function (basket) {
        this.context.shipping_address = this.getAddressRequestBuilder().build(basket);

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
        var giftCertificates = order.getGiftCertificateLineItems().toArray();
        var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();
        var shipments = order.shipments;

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
        var gcTotalAmount = this.getGCtotalAmount(order);

        this.context.order_amount = Math.round(orderAmount - gcTotalAmount);

		// Set order discount line items
        this.addPriceAdjustments(order.priceAdjustments, null, null, this.context);

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isTaxationPolicyNet = function () {
        return (this.getLocaleObject().country === 'US');
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalTax = function (order) {
        var totalTax = order.totalTax.value * 100;
        var usTotalTax = 0;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round(totalTax);

        if (this.isTaxationPolicyNet()) {
            usTotalTax = (order.totalTax.available) ? order.totalTax.value * 100 : 0;
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
        this.context.options.color_details 					= Site.getCurrent().getCustomPreferenceValue('kpColorDetails');
        this.context.options.color_button 					= Site.getCurrent().getCustomPreferenceValue('kpColorButton');
        this.context.options.color_button_text 				= Site.getCurrent().getCustomPreferenceValue('kpColorButtonText');
        this.context.options.color_checkbox 				= Site.getCurrent().getCustomPreferenceValue('kpColorCheckbox');
        this.context.options.color_checkbox_checkmark 		= Site.getCurrent().getCustomPreferenceValue('kpColorCheckboxCheckmark');
        this.context.options.color_header 					= Site.getCurrent().getCustomPreferenceValue('kpColorHeader');
        this.context.options.color_link 					= Site.getCurrent().getCustomPreferenceValue('kpColorLink');
        this.context.options.color_border 					= Site.getCurrent().getCustomPreferenceValue('kpColorBorder');
        this.context.options.color_border_selected 			= Site.getCurrent().getCustomPreferenceValue('kpColorBorderSelected');
        this.context.options.color_text 					= Site.getCurrent().getCustomPreferenceValue('kpColorText');
        this.context.options.color_text_secondary 			= Site.getCurrent().getCustomPreferenceValue('kpColorTextSecondary');
        this.context.options.radius_border 					= Site.getCurrent().getCustomPreferenceValue('kpRadiusBorder');

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildMerchantInformation = function ()	{
        var country = this.getLocaleObject().country;

        this.context.merchant_urls.confirmation = URLUtils.https('KLARNA_PAYMENTS-Confirmation', 'klarna_country', country).toString();
        this.context.merchant_urls.notification = URLUtils.https('KLARNA_PAYMENTS-Notification', 'klarna_country', country).toString();

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

    KlarnaPaymentsOrderRequestBuilder.prototype.getGCtotalAmount = function (order) {
        var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();
        var gcTotalAmount = 0;
        var i = 0;

        if (giftCertificatePIs.length > 0) {
            for (i = 0; i < giftCertificatePIs.length; i++) {
                gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;
            }
        }
        return gcTotalAmount;
    };


    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipmentItem = function (shipment) {
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
        shippingLineItem.total_tax_amount = (this.isTaxationPolicyNet()) ? 0 : Math.round(shipment.shippingTotalTax.value * 100);

        return shippingLineItem;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getShipmentTaxRate = function (shipment) {
        var shipmentTaxRate = 0;

        if (!empty(shipment.shippingMethod) && !empty(shipment.shippingMethod.taxClassID) && !empty(shipment.shippingAddress)) {
            shipmentTaxRate = (this.isTaxationPolicyNet()) ? 0 : (TaxMgr.getTaxRate(shipment.shippingMethod.taxClassID, TaxMgr.getTaxJurisdictionID(new ShippingLocation(shipment.shippingAddress)))) * 10000;
        }

        return shipmentTaxRate;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getShipmentUnitPrice = function (shipment) {
        var shipmentUnitPrice = (shipment.shippingTotalGrossPrice.available && !this.isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value) * 100;

        return shipmentUnitPrice;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipments = function (shipments, context) {
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

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentPromoName = function (adj) {
        var promoName = !empty(adj.promotion) && !empty(adj.promotion.name) ? adj.promotion.name : ORDER_LINE_TYPE.DISCOUNT;

        promoName = promoName.replace(/[^\x00-\x7F]/g, '');

        return promoName;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentPromoId = function (adj, pid, oid) {
        var promoId = adj.promotionID;

        if (!empty(pid)) {
            promoId = pid + '_' + promoId;
        } else if (!empty(oid)) {
            promoId = oid + '_' + promoId;
        }

        return promoId;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentMerchantData = function (adj) {
        return (adj.couponLineItem ? adj.couponLineItem.couponCode : '');
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentTaxRate = function (adj) {
        return (this.isTaxationPolicyNet()) ? 0 : Math.round(adj.taxRate * 10000);
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.addPriceAdjustments = function (adjusments, pid, oid, context) {
        var adjusmentPrice = 0;
        var adj = {};
        var adjustment = {};

        for (var i = 0; i < adjusments.length; i++) {
            adj = adjusments[i];
            adjustment = new LineItem();
            adjusmentPrice = (adj.grossPrice.available && !this.isTaxationPolicyNet() ? adj.grossPrice.value : adj.netPrice.value) * 100;

            adjustment.quantity = 1;
            adjustment.type = ORDER_LINE_TYPE.DISCOUNT;
            adjustment.name = this.getPriceAdjustmentPromoName(adj);
            adjustment.reference = this.getPriceAdjustmentPromoId(adj);
            adjustment.unit_price = Math.round(adjusmentPrice);
            adjustment.merchant_data = this.getPriceAdjustmentMerchantData(adj);
            adjustment.tax_rate = this.getPriceAdjustmentTaxRate(adj);
            adjustment.total_amount = adjustment.unit_price;
            adjustment.total_tax_amount = (this.isTaxationPolicyNet()) ? 0 : Math.round(adj.tax.value * 100);

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

    module.exports = KlarnaPaymentsOrderRequestBuilder;
}());
