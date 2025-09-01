/* globals empty */

( function() {
    'use strict';

    var Site = require( 'dw/system/Site' );
    var log = require( 'dw/system/Logger' ).getLogger( 'KlarnaPayments' );
    var URLUtils = require( 'dw/web/URLUtils' );
    var Money = require( 'dw/value/Money' );

    var Builder = require( '*/cartridge/scripts/payments/builder' );
    var KlarnaExpressCheckoutModel = require( '*/cartridge/scripts/payments/model/request/kec' ).klarnaExpressCheckoutModel;
    var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
    var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
    var OrderLineItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/kecLineItem' );
    var GiftCertItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificateLineItem' );
    var GiftCertPaymentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificatePayment' );
    var PriceAdjustmentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/priceAdjustment' );
    var SalesTaxRequestRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/salesTax' );
    var AdditionalCustomerInfoRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo' );
    var OptionsRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/options' );
    var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();

    /**
     * KP Session Request Builder
     * @return {void}
     */
    function KlarnaExpressCheckoutRequestBuilder() {
        this.orderLineItemRequestBuilder = new OrderLineItemRequestBuilder();
        this.giftCertLineItemRequestBuilder = new GiftCertItemRequestBuilder();
        this.giftCertPaymentRequestBuilder = new GiftCertPaymentRequestBuilder();
        this.priceAdjustmentRequestBuilder = new PriceAdjustmentRequestBuilder();
        this.salesTaxRequestBuilder = new SalesTaxRequestRequestBuilder();
        this.additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();
        this.optionsRequestBuilder = new OptionsRequestBuilder();

        this.context = null;
        this.params = null;
    }

    KlarnaExpressCheckoutRequestBuilder.prototype = new Builder();

    KlarnaExpressCheckoutRequestBuilder.prototype.getOrderLineItemRequestBuilder = function() {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getGiftCertLineItemRequestBuilder = function() {
        return this.giftCertLineItemRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function() {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getSalesTaxRequestBuilder = function() {
        return this.salesTaxRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function() {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getOptionsRequestBuilder = function() {
        return this.optionsRequestBuilder;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.setLocaleObject = function( localeObject ) {
        this.localeObject = localeObject;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getLocaleObject = function() {
        return this.localeObject;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.setParams = function( params ) {
        this.validateParams( params );

        this.setLocaleObject( params.localeObject.custom );

        this.params = params;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.init = function() {
        this.context = new KlarnaExpressCheckoutModel();

        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildCurrencyCode = function( basket ) {
        this.context.currency = basket.getCurrencyCode();

        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildOrderLines = function( basket ) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var giftCertificates = basket.getGiftCertificateLineItems().toArray();

        this.buildItems( lineItems, null, this );

        if ( giftCertificates.length > 0 ) {
            this.buildItems( giftCertificates, null, this );
        }

        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getOrderAmount = function( basket ) {
        return ( ( basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value ) * 100 );
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getGiftCertificateAmount = function( basket ) {
        var currencyCode = basket.getCurrencyCode();
        var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
        var gcTotalAmount = new Money( 0, currencyCode );

        if ( giftCertificatePIs.length > 0 ) {
            for ( var i = 0; i < giftCertificatePIs.length; i++ ) {
                gcTotalAmount = gcTotalAmount.add( new Money( giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100, currencyCode ) );
            }
        }

        return gcTotalAmount.getValue();
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildTotalAmount = function( basket ) {
        var currencyCode = basket.getCurrencyCode();
        var orderAmount = new Money( this.getOrderAmount( basket ), currencyCode );
        var giftCertificateAmount = new Money( this.getGiftCertificateAmount( basket ), currencyCode );
        var totalAmount = orderAmount.subtract( giftCertificateAmount ).getValue();
        this.context.amount = totalAmount;

        // Set order discount line items
        if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
            this.addPriceAdjustments( basket.priceAdjustments, null, null, this.context );
        }

        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildAdditionalCustomerInfo = function( basket ) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build( basket );

        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.validateBuildAmounts = function( basket ) {
        var currencyCode = basket.getCurrencyCode();
        var amount = new Money( this.context.amount, currencyCode );
        var orderLines = this.context.supplementaryPurchaseData.lineItems;
        var orderLinesTotals = new Money( 0, currencyCode );

        for ( var i = 0; i < orderLines.length; i++ ) {
            orderLinesTotals = orderLinesTotals.add( new Money( orderLines[i].totalAmount, currencyCode ) );
        }
        var shipmentCost = this.getShipmentCost( basket );
        orderLinesTotals = orderLinesTotals.add( new Money( shipmentCost, currencyCode ) );

        if ( isTaxationPolicyNet() ) {
            var salesTaxItem = this.getSalesTaxRequestBuilder().build( basket );
            var totalTaxAmount = salesTaxItem ? salesTaxItem.total_amount : 0;
            orderLinesTotals = orderLinesTotals.add( new Money( totalTaxAmount, currencyCode ) );
        }

        // Check if total amount is equal to order amount incl. shipping cost
        if ( amount.getValue() !== orderLinesTotals.getValue() ) {
            log.error( 'KlarnaExpressCheckoutRequestBuilder.validateBuildAmounts: Order amount or tax amount DO NOT match.' );
            this.context.amount = orderLinesTotals.getValue();
        }
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildItem = function( li ) {
        var item = this.getOrderLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildGCItem = function( li ) {
        var item = this.getGiftCertLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildItems = function( items, subscription ) {
        var requestBuilderHelper = require( '*/cartridge/scripts/util/requestBuilderHelper' );
        this.context.supplementaryPurchaseData = {
            lineItems: requestBuilderHelper.buildItems( items, null, null, this )
        };
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildGCPaymentItems = function( items ) {
        var i = 0;
        var li = {};
        var newItem = {};

        while ( i < items.length ) {
            li = items[i];

            newItem = this.giftCertPaymentRequestBuilder.build( li );

            this.context.order_lines.push( newItem );

            i += 1;
        }
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.getShipmentCost = function( basket ) {
        var shipment = {};
        var currencyCode = basket.getCurrencyCode();
        var shipmentCost = new Money( 0, currencyCode );

        for ( var i = 0; i < basket.shipments.length; i++ ) {
            shipment = basket.shipments[i];

            if ( shipment.productLineItems.length === 0 ) {
                continue;
            }

            if ( !empty( shipment.shippingMethod ) ) {
                var shipmentCostValue = ( shipment.shippingTotalGrossPrice.available && !isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value ) * 100;
                shipmentCost = shipmentCost.add( new Money( shipmentCostValue, currencyCode ) );

                if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
                    this.addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null );
                }
            }
        }
        return shipmentCost.getValue();
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.addPriceAdjustments = function( adjusments, pid, oid ) {
        var adj = {};
        var adjustment = {};
        var priceAdjustmentRequestBuilder = this.getPriceAdjustmentRequestBuilder();

        for ( var i = 0; i < adjusments.length; i++ ) {
            adj = adjusments[i];

            priceAdjustmentRequestBuilder.setProductId( pid );
            priceAdjustmentRequestBuilder.setObjectId( oid );

            adjustment = priceAdjustmentRequestBuilder.build( adj );

            this.context.order_lines.push( adjustment );
        }
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.isLocaleObjectParamsValid = function( localeObject ) {
        return ( !empty( localeObject.custom.country ) || !empty( localeObject.custom.klarnaLocale ) );
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.isParamsValid = function( params ) {
        return ( !empty( params.basket ) && !empty( params.localeObject ) && this.isLocaleObjectParamsValid( params.localeObject ) );
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.validateParams = function( params ) {
        if ( empty( params ) || !this.isParamsValid( params ) ) {
            throw new Error( 'Error when generating KlarnaExpressCheckoutRequestBuilder. Not valid params.' );
        }
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.buildReturnUrl = function( basket ) {
        this.context.customerInteractionConfig = {
            returnUrl: URLUtils.https( 'Order-Confirm' ).toString()
        };
        return this;
    };

    KlarnaExpressCheckoutRequestBuilder.prototype.build = function() {
        var basket = this.params.basket;
        var kpAttachmentsPreferenceValue = Site.getCurrent().getCustomPreferenceValue( 'kpEMD' ) || null;

        this.init();

        this.buildCurrencyCode( basket );

        if ( kpAttachmentsPreferenceValue ) {
            this.buildAdditionalCustomerInfo( basket );
        }

        this.buildOrderLines( basket );
        this.buildTotalAmount( basket );
        this.buildReturnUrl( basket );
        
        // Validate the built data using the context and line items
        this.validateBuildAmounts( basket );

        return this.context;
    };

    module.exports = KlarnaExpressCheckoutRequestBuilder;
}() );
