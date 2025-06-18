/* globals empty */

( function() {
    'use strict';

    var Site = require( 'dw/system/Site' );
    var log = require( 'dw/system/Logger' ).getLogger( 'KlarnaPayments' );
    var URLUtils = require( 'dw/web/URLUtils' );

    var Builder = require( '*/cartridge/scripts/payments/builder' );
    var KlarnaPaymentsSessionModel = require( '*/cartridge/scripts/payments/model/request/kec' ).KlarnaPaymentsSessionModel;
    var isEnabledPreassessmentForCountry = require( '*/cartridge/scripts/util/klarnaHelper' ).isEnabledPreassessmentForCountry;
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
    function KlarnaPaymentsSessionRequestBuilder() {
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

    KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderLineItemRequestBuilder = function() {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getGiftCertLineItemRequestBuilder = function() {
        return this.giftCertLineItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function() {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function() {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOptionsRequestBuilder = function() {
        return this.optionsRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setLocaleObject = function( localeObject ) {
        this.localeObject = localeObject;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getLocaleObject = function() {
        return this.localeObject;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setParams = function( params ) {
        this.validateParams( params );

        this.setLocaleObject( params.localeObject.custom );

        this.params = params;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.init = function( preAssement ) {
        this.context = new KlarnaPaymentsSessionModel( preAssement );

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildCurrencyCode = function( basket ) {
        this.context.currency = basket.getCurrencyCode();

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOrderLines = function( basket ) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var giftCertificates = basket.getGiftCertificateLineItems().toArray();

        this.buildItems( lineItems, null, this );

        if ( giftCertificates.length > 0 ) {
            this.buildItems( giftCertificates, null, this );
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderAmount = function( basket ) {
        return ( ( basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value ) * 100 );
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getGiftCertificateAmount = function( basket ) {
        var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();
        var gcTotalAmount = 0;

        if ( giftCertificatePIs.length > 0 ) {
            for ( var i = 0; i < giftCertificatePIs.length; i++ ) {
                gcTotalAmount += giftCertificatePIs[i].getPaymentTransaction().getAmount() * 100;
            }
        }

        return gcTotalAmount;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalAmount = function( basket ) {
        var orderAmount = this.getOrderAmount( basket );
        var giftCertificateAmount = this.getGiftCertificateAmount( basket );
        var totalAmount = orderAmount - giftCertificateAmount;
        this.context.amount = Math.round( totalAmount );

        // Set order discount line items
        if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
            this.addPriceAdjustments( basket.priceAdjustments, null, null, this.context );
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfo = function( basket ) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build( basket );

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.validateBuildAmounts = function( basket ) {
        var amount = this.context.amount;
        var orderLines = this.context.supplementaryPurchaseData.lineItems;
        var orderLinesTotals = 0;

        for ( var i = 0; i < orderLines.length; i++ ) {
            orderLinesTotals += orderLines[i].totalAmount;
        }
        var shipmentCost = this.getShipmentCost( basket );
        orderLinesTotals += shipmentCost;

        // Check if total amount is equal to order amount incl. shipping cost
        if ( amount !== orderLinesTotals ) {
            log.error( 'KlarnaPaymentsSessionRequestBuilder.validateBuildAmounts: Order amount or tax amount DO NOT match.' );
            this.context.amount = orderLinesTotals;
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItem = function( li ) {
        var item = this.getOrderLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildGCItem = function( li ) {
        var item = this.getGiftCertLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildItems = function( items, subscription ) {
        var requestBuilderHelper = require( '*/cartridge/scripts/util/requestBuilderHelper' );
        this.context.supplementaryPurchaseData = {
            lineItems: requestBuilderHelper.buildItems( items, null, null, this )
        };
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildGCPaymentItems = function( items ) {
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

    KlarnaPaymentsSessionRequestBuilder.prototype.getShipmentCost = function( basket ) {
        var shipment = {};
        var shipmentCost = 0;

        for ( var i = 0; i < basket.shipments.length; i++ ) {
            shipment = basket.shipments[i];

            if ( shipment.productLineItems.length === 0 ) {
                continue;
            }

            if ( !empty( shipment.shippingMethod ) ) {
                shipmentCost += ( shipment.shippingTotalGrossPrice.available && !isTaxationPolicyNet() ? shipment.shippingTotalGrossPrice.value : shipment.shippingTotalNetPrice.value ) * 100;
                
                if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
                    this.addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null );
                }
            }
        }
        return shipmentCost;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.addPriceAdjustments = function( adjusments, pid, oid ) {
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

    KlarnaPaymentsSessionRequestBuilder.prototype.isLocaleObjectParamsValid = function( localeObject ) {
        return ( !empty( localeObject.custom.country ) || !empty( localeObject.custom.klarnaLocale ) );
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.isParamsValid = function( params ) {
        return ( !empty( params.basket ) && !empty( params.localeObject ) && this.isLocaleObjectParamsValid( params.localeObject ) );
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.validateParams = function( params ) {
        if ( empty( params ) || !this.isParamsValid( params ) ) {
            throw new Error( 'Error when generating KlarnaPaymentsSessionRequestBuilder. Not valid params.' );
        }
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildReturnUrl = function( basket ) {
        this.context.customerInteractionConfig = {
            returnUrl: URLUtils.https( 'Order-Confirm' ).toString()
        };
        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.build = function() {
        var basket = this.params.basket;
        var preAssement = isEnabledPreassessmentForCountry( this.getLocaleObject().country );
        var kpAttachmentsPreferenceValue = Site.getCurrent().getCustomPreferenceValue( 'kpEMD' ) || null;

        this.init( preAssement );

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

    module.exports = KlarnaPaymentsSessionRequestBuilder;
}() );
