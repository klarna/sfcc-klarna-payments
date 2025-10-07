/* globals empty */

( function() {
    'use strict';

    var Site = require( 'dw/system/Site' );
    var log = require( 'dw/system/Logger' ).getLogger( 'KlarnaPayments' );
    var URLUtils = require( 'dw/web/URLUtils' );
    var Money = require( 'dw/value/Money' );

    var Builder = require( '*/cartridge/scripts/payments/builder' );
    var KlarnaExpressCheckoutModel = require( '*/cartridge/scripts/payments/model/request/singleStepKec' ).singleStepKECModel;
    var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
    var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
    var OrderLineItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/singleStepKecLineItem' );
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
    function KlarnaSingleStepCheckoutRequestBuilder() {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype = new Builder();

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getOrderLineItemRequestBuilder = function() {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getGiftCertLineItemRequestBuilder = function() {
        return this.giftCertLineItemRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function() {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getSalesTaxRequestBuilder = function() {
        return this.salesTaxRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getAdditionalCustomerInfoRequestBuilder = function() {
        return this.additionalCustomerInfoRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getOptionsRequestBuilder = function() {
        return this.optionsRequestBuilder;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.setLocaleObject = function( localeObject ) {
        this.localeObject = localeObject;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getLocaleObject = function() {
        return this.localeObject;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.setParams = function( params ) {
        this.validateParams( params );

        this.setLocaleObject( params.localeObject.custom );

        this.params = params;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.init = function() {
        this.context = new KlarnaExpressCheckoutModel();

        return this;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildCurrencyCode = function( basket ) {
        this.context.currency = basket.getCurrencyCode();

        return this;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildOrderLines = function( basket ) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var giftCertificates = basket.getGiftCertificateLineItems().toArray();

        this.buildItems( lineItems, null, this );

        if ( giftCertificates.length > 0 ) {
            this.buildItems( giftCertificates, null, this );
        }

        return this;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getOrderAmount = function( basket ) {
        return ( ( basket.totalGrossPrice.available ? basket.totalGrossPrice.value : basket.totalNetPrice.value ) * 100 );
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getGiftCertificateAmount = function( basket ) {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildTotalAmount = function( basket ) {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildAdditionalCustomerInfo = function( basket ) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build( basket );

        return this;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.validateBuildAmounts = function( basket ) {
        var currencyCode = basket.getCurrencyCode();
        var amount = new Money( this.context.amount, currencyCode );
        var orderLines = this.context.supplementary_purchase_data.line_items;
        var orderLinesTotals = new Money( 0, currencyCode );

        for ( var i = 0; i < orderLines.length; i++ ) {
            orderLinesTotals = orderLinesTotals.add( new Money( orderLines[i].total_amount, currencyCode ) );
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildItem = function( li ) {
        var item = this.getOrderLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildGCItem = function( li ) {
        var item = this.getGiftCertLineItemRequestBuilder().build( li );

        return item;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildItems = function( items, subscription ) {
        var requestBuilderHelper = require( '*/cartridge/scripts/util/requestBuilderHelper' );
        this.context.supplementary_purchase_data = {
            line_items: requestBuilderHelper.buildItems( items, null, null, this )
        };
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildGCPaymentItems = function( items ) {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.getShipmentCost = function( basket ) {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.addPriceAdjustments = function( adjusments, pid, oid ) {
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

    KlarnaSingleStepCheckoutRequestBuilder.prototype.isLocaleObjectParamsValid = function( localeObject ) {
        return ( !empty( localeObject.custom.country ) || !empty( localeObject.custom.klarnaLocale ) );
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.isParamsValid = function( params ) {
        return ( !empty( params.basket ) && !empty( params.localeObject ) && this.isLocaleObjectParamsValid( params.localeObject ) );
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.validateParams = function( params ) {
        if ( empty( params ) || !this.isParamsValid( params ) ) {
            throw new Error( 'Error when generating KlarnaExpressCheckoutRequestBuilder. Not valid params.' );
        }
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.buildReturnUrl = function( basket ) {
        this.context.customer_interaction_config = {
            method: "HANDOVER",
            return_url: URLUtils.https( 'Order-Confirm' ).toString()
        };
        return this;
    };

    KlarnaSingleStepCheckoutRequestBuilder.prototype.build = function() {
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

    module.exports = KlarnaSingleStepCheckoutRequestBuilder;
}() );
