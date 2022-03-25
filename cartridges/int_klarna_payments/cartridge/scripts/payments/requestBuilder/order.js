/* globals empty */

( function() {
    'use strict';

    var URLUtils = require( 'dw/web/URLUtils' );
    var Site = require( 'dw/system/Site' );
    var Logger = require( 'dw/system/Logger' );

    var log = Logger.getLogger( 'KlarnaPayments' );

    var Builder = require( '*/cartridge/scripts/payments/builder' );

    var KlarnaPaymentsOrderModel = require( '*/cartridge/scripts/payments/model/request/order' ).KlarnaPaymentsOrderModel;

    var AddressRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/address' );
    var OrderLineItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/orderLineItem' );
    var GiftCertItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificateLineItem' );
    var GiftCertPaymentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificatePayment' );
    var ShipmentItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/shipmentItem' );
    var PriceAdjustmentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/priceAdjustment' );
    var SalesTaxRequestRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/salesTax' );
    var AdditionalCustomerInfoRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo' );
    var OptionsRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/options' );

    var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
    var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
    var getShippment = require( '*/cartridge/scripts/util/klarnaHelper' ).getShippment;

    /**
     * KP Order Request Builder
     * @return {void}
     */
    function KlarnaPaymentsOrderRequestBuilder() {
        this.addressRequestBuilder = new AddressRequestBuilder();
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.giftCertLineItemRequestBuilder = new GiftCertItemRequestBuilder();
        this.giftCertPaymentRequestBuilder = new GiftCertPaymentRequestBuilder();
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

    /**
     * Function to return address request builder
     *
     * @return {Object} Address request
     */
    KlarnaPaymentsOrderRequestBuilder.prototype.getAddressRequestBuilder = function() {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOrderLineItemRequestBuilder = function() {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getShipmentItemRequestBuilder = function() {
        return this.shipmentItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getGiftCertLineItemRequestBuilder = function() {
        return this.giftCertLineItemRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getGiftCertPaymentRequestBuilder = function() {
        return this.giftCertPaymentRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function() {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getSalesTaxRequestBuilder = function() {
        return this.salesTaxRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function() {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOptionsRequestBuilder = function() {
        return this.optionsRequestBuilder;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setParams = function( params ) {
        this.validateParams( params );

        this.setLocaleObject( params.localeObject.custom );

        this.params = params;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setLocaleObject = function( localeObject ) {
        this.localeObject = localeObject;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getLocaleObject = function() {
        return this.localeObject;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.init = function() {
        this.context = new KlarnaPaymentsOrderModel();

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.setMerchantReference = function( order ) {
        this.context.merchant_reference1 = order.orderNo;
        this.context.merchant_reference2 = '';

        if ( Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' ) ) {
            try {
                this.context.merchant_reference2 = order[Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' )].toString();
            } catch ( err ) {
                log.error( 'merchant_reference2 was not set. Error: {0} ', err.message );
            }
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildBilling = function( order ) {
        var billingAddress = order.getBillingAddress();
        if ( billingAddress === null ) {
            return this;
        }

        this.context.billing_address = this.getAddressRequestBuilder().build( billingAddress );
        this.context.billing_address.email = order.customerEmail || '';

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipping = function( order ) {
        // get default shipment shipping address
        var shipment = getShippment( order );
        var shippingAddress = !empty( shipment ) ? shipment.getShippingAddress() : null;

        if ( shippingAddress === null || shippingAddress.address1 === null ) {
            delete this.context.shipping_address;
            return this;
        }

        this.context.shipping_address = this.getAddressRequestBuilder().build( shippingAddress );
        this.context.shipping_address.email = order.customerEmail;

        // If we have store pickup as the only address, then we need to use the first & last name form billing
        // as sending store name should not be used
        var storePickUp = !empty( shipment.custom.fromStoreId );
        var billingAddress = order.getBillingAddress();

        if ( storePickUp && !empty( billingAddress.firstName ) ) {
            this.context.shipping_address.given_name = billingAddress.firstName;
        }

        if ( storePickUp && !empty( billingAddress.lastName ) ) {
            this.context.shipping_address.family_name = billingAddress.lastName;
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildLocale = function( order ) {
        var localeObject = this.getLocaleObject();
        var currency = order.getCurrencyCode();

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildOrderLines = function( order ) {
        var lineItems = order.getAllProductLineItems().toArray();
        var giftCertificates = order.getGiftCertificateLineItems().toArray();
        var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();

        this.buildItems( lineItems, this.context );

        if ( giftCertificates.length > 0 ) {
            this.buildItems( giftCertificates, this.context );
        }

        if ( giftCertificatePIs.length > 0 ) {
            this.buildGCPaymentItems( giftCertificatePIs, this.context );
        }

        var shipments = order.shipments;
        this.buildShipments( shipments, this.context );

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getOrderAmount = function( order ) {
        var orderAmount = 0;

        if ( order.totalGrossPrice.available ) {
            orderAmount = order.totalGrossPrice.value * 100;
        } else {
            orderAmount = order.totalNetPrice.value * 100;
        }

        return orderAmount;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.getGiftCertificateAmount = function( order ) {
        var giftCertificatePIs = order.getGiftCertificatePaymentInstruments().toArray();
        var gcTotalAmount = 0;

        if ( giftCertificatePIs.length > 0 ) {
            for ( var i = 0; i < giftCertificatePIs.length; i++ ) {
                gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;
            }
        }

        return gcTotalAmount;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalAmount = function( order ) {
        var orderAmount = this.getOrderAmount( order );
        var giftCertificateAmount = this.getGiftCertificateAmount( order );
        var totalAmount = orderAmount - giftCertificateAmount;

        this.context.order_amount = Math.round( totalAmount );

        // Set order discount line items
        if ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) {
            this.addPriceAdjustments( order.priceAdjustments, null, null, this.context );
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildTotalTax = function( order ) {
        var totalTax = order.totalTax.value * 100;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round( totalTax );

        if ( isTaxationPolicyNet() ) {
            salesTaxItem = this.getSalesTaxRequestBuilder().build( order );

            this.context.order_lines.push( salesTaxItem );
        }

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildAdditionalCustomerInfo = function( order ) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build( order );

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildOptions = function() {
        var currentSite = Site.getCurrent();

        var preferences = {
            kpColorDetails: currentSite.getCustomPreferenceValue( 'kpColorDetails' ),
            kpColorButton: currentSite.getCustomPreferenceValue( 'kpColorButton' ),
            kpColorButtonText: currentSite.getCustomPreferenceValue( 'kpColorButtonText' ),
            kpColorCheckbox: currentSite.getCustomPreferenceValue( 'kpColorCheckbox' ),
            kpColorCheckboxCheckmark: currentSite.getCustomPreferenceValue( 'kpColorCheckboxCheckmark' ),
            kpColorHeader: currentSite.getCustomPreferenceValue( 'kpColorHeader' ),
            kpColorLink: currentSite.getCustomPreferenceValue( 'kpColorLink' ),
            kpColorBorder: currentSite.getCustomPreferenceValue( 'kpColorBorder' ),
            kpColorBorderSelected: currentSite.getCustomPreferenceValue( 'kpColorBorderSelected' ),
            kpColorText: currentSite.getCustomPreferenceValue( 'kpColorText' ),
            kpColorTextSecondary: currentSite.getCustomPreferenceValue( 'kpColorTextSecondary' ),
            kpRadiusBorder: currentSite.getCustomPreferenceValue( 'kpRadiusBorder' ),
            kpVatRemoved: currentSite.getCustomPreferenceValue( 'kpVatRemoved' )
        };

        var options = this.getOptionsRequestBuilder().build( preferences );

        this.context.options = options;

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildMerchantInformation = function( order ) {
        var country = this.getLocaleObject().country;

        var KLARNA_PAYMENT_URLS = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).KLARNA_PAYMENT_URLS;

        this.context.merchant_urls.confirmation = URLUtils.https( KLARNA_PAYMENT_URLS.CONFIRMATION, 'klarna_country', country ).toString();
        this.context.merchant_urls.notification = URLUtils.https( KLARNA_PAYMENT_URLS.NOTIFICATION, 'klarna_country', country ).toString();

        return this;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildItem = function( li ) {
        var item = this.getOrderLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildGCItem = function( li ) {
        var item = this.getGiftCertLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildItems = function( items, context ) {
        var i = 0;
        var li = {};
        var item = {};

        while ( i < items.length ) {
            li = items[i];
            var isGiftCertificate = ( li.describe().getSystemAttributeDefinition( 'recipientEmail' ) && !empty( li.recipientEmail ) ) ? true : false;

            if ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) {
                // Add product-specific shipping line adjustments
                if ( !isGiftCertificate && !empty( li.shippingLineItem ) ) {
                    this.addPriceAdjustments( li.shippingLineItem.priceAdjustments.toArray(), li.productID, null, context );
                }

                if ( !isGiftCertificate && !empty( li.priceAdjustments ) && li.priceAdjustments.length > 0 ) {
                    this.addPriceAdjustments( li.priceAdjustments.toArray(), li.productID, li.optionID, context );
                }
            }

            if ( isGiftCertificate ) {
                item = this.buildGCItem( li );
            } else {
                item = this.buildItem( li );
            }

            context.order_lines.push( item );

            i += 1;
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildGCPaymentItems = function( items, context ) {
        var i = 0;
        var li = {};
        var newItem = {};

        while ( i < items.length ) {
            li = items[i];

            newItem = this.giftCertPaymentRequestBuilder.build( li );

            context.order_lines.push( newItem );

            i += 1;
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.buildShipments = function( shipments, context ) {
        var shipment = {};
        var shippingLineItem = {};

        for ( var i = 0; i < shipments.length; i++ ) {
            shipment = shipments[i];

            if ( shipment.productLineItems.length === 0 ) {
                continue;
            }

            if ( !empty( shipment.shippingMethod ) ) {
                shippingLineItem = this.getShipmentItemRequestBuilder().build( shipment );

                if ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) {
                    this.addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null, context );
                }

                context.order_lines.push( shippingLineItem );
            }
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.addPriceAdjustments = function( adjusments, pid, oid, context ) {
        var adj = {};
        var adjustment = {};
        var priceAdjustmentRequestBuilder = this.getPriceAdjustmentRequestBuilder();

        for ( var i = 0; i < adjusments.length; i++ ) {
            adj = adjusments[i];

            adjustment = priceAdjustmentRequestBuilder.build( adj );

            context.order_lines.push( adjustment );
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isValidLocaleObjectParams = function( localeObject ) {
        return ( !empty( localeObject.custom.country ) || !empty( localeObject.custom.klarnaLocale ) );
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.isValidParams = function( params ) {
        return ( !empty( params.order ) && !empty( params.localeObject ) && this.isValidLocaleObjectParams( params.localeObject ) );
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.validateParams = function( params ) {
        if ( empty( params ) || !this.isValidParams( params ) ) {
            throw new Error( 'Error when generating KlarnaPaymentsOrderRequestBuilder. Not valid params.' );
        }
    };

    KlarnaPaymentsOrderRequestBuilder.prototype.build = function() {
        var order = this.params.order;

        this.init()
            .setMerchantReference( order )
            .buildLocale( order )
            .buildBilling( order )
            .buildShipping( order )
            .buildOrderLines( order )
            .buildTotalAmount( order )
            .buildTotalTax( order )
            .buildAdditionalCustomerInfo( order )
            .buildOptions()
            .buildMerchantInformation( order );

        return this.context;
    };

    module.exports = KlarnaPaymentsOrderRequestBuilder;
}() );
