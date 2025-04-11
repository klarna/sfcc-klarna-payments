/* globals empty */

( function() {
    'use strict';

    var Site = require( 'dw/system/Site' );
    var Logger = require( 'dw/system/Logger' );
    var log = Logger.getLogger( 'KlarnaPayments' );

    var Builder = require( '*/cartridge/scripts/payments/builder' );
    var KlarnaPaymentsSessionModel = require( '*/cartridge/scripts/payments/model/request/session' ).KlarnaPaymentsSessionModel;
    var isEnabledPreassessmentForCountry = require( '*/cartridge/scripts/util/klarnaHelper' ).isEnabledPreassessmentForCountry;
    var isTaxationPolicyNet = require( '*/cartridge/scripts/util/klarnaHelper' ).isTaxationPolicyNet;
    var discountTaxationMethod = require( '*/cartridge/scripts/util/klarnaHelper' ).getDiscountsTaxation();
    var getShippment = require( '*/cartridge/scripts/util/klarnaHelper' ).getShippment;
    var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

    var AddressRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/address' );
    var OrderLineItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/orderLineItem' );
    var GiftCertItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificateLineItem' );
    var GiftCertPaymentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/giftCertificatePayment' );
    var ShipmentItemRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/shipmentItem' );
    var PriceAdjustmentRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/priceAdjustment' );
    var SalesTaxRequestRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/salesTax' );
    var AdditionalCustomerInfoRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo' );
    var OptionsRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/options' );
    var isOMSEnabled = require( '*/cartridge/scripts/util/klarnaHelper' ).isOMSEnabled();
    var subscriptionHelper = require( '*/cartridge/scripts/subscription/subscriptionHelper' );
    var subscriptionHelperExtension = require( '*/cartridge/scripts/subscription/subscriptionHelperExtension' );

    /**
     * KP Session Request Builder
     * @return {void}
     */
    function KlarnaPaymentsSessionRequestBuilder() {
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
        this.params = null;
    }

    KlarnaPaymentsSessionRequestBuilder.prototype = new Builder();

    KlarnaPaymentsSessionRequestBuilder.prototype.getAddressRequestBuilder = function() {
        return this.addressRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getOrderLineItemRequestBuilder = function() {
        return this.orderLineItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getGiftCertLineItemRequestBuilder = function() {
        return this.giftCertLineItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getGiftCertPaymentRequestBuilder = function() {
        return this.giftCertPaymentRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getShipmentItemRequestBuilder = function() {
        return this.shipmentItemRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getPriceAdjustmentRequestBuilder = function() {
        return this.priceAdjustmentRequestBuilder;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.getSalesTaxRequestBuilder = function() {
        return this.salesTaxRequestBuilder;
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

    KlarnaPaymentsSessionRequestBuilder.prototype.init = function( preAssement, kpIsExpressCheckout ) {
        this.context = new KlarnaPaymentsSessionModel( preAssement, kpIsExpressCheckout );

        this.getShipmentItemRequestBuilder().setMerchantDataAvailable( preAssement );

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.setMerchantReference = function( basket ) {
        this.context.merchant_reference2 = '';
        var merchant_reference2config = Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2' ) ? Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2' ) : Site.getCurrent().getCustomPreferenceValue( 'merchant_reference2_mapping' );

        if ( merchant_reference2config ) {
            try {
                this.context.merchant_reference2 = basket[merchant_reference2config].toString();
            } catch ( err ) {
                log.error( 'merchant_reference2 was not set. Error: {0} ', err.message );
                KlarnaAdditionalLogging.writeLog( basket, basket.custom.kpSessionId, 'requestByilder/session.js:KlarnaPaymentsSessionRequestBuilder.prototype.setMerchantReference()', 'Merchant_reference2 was not set. Error:' + JSON.stringify( err ) );
            }
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildBilling = function( basket ) {
        var currentCustomer = basket.getCustomer();
        var customerPreferredAddress = {};

        this.context.billing_address.email = basket.customerEmail || '';

        var billingAddress = basket.getBillingAddress();

        if ( empty( currentCustomer ) || empty( currentCustomer.profile ) ) {
            var billingAddress = billingAddress || basket.getShipments().iterator().next().getShippingAddress();
            if ( empty( billingAddress ) ) {
                return this;
            }

            this.context.billing_address = this.getAddressRequestBuilder().build( billingAddress );
            this.context.billing_address.email = basket.customerEmail || '';

            return this;
        }

        if ( billingAddress ) {
            this.context.billing_address = this.getAddressRequestBuilder().build( billingAddress );
            this.context.billing_address.email =  basket.customerEmail || currentCustomer.profile.email;
            return this;
        }

        this.context.billing_address.phone = currentCustomer.profile.phoneHome;
        this.context.billing_address.given_name = currentCustomer.profile.firstName;
        this.context.billing_address.family_name = currentCustomer.profile.lastName;

        customerPreferredAddress = currentCustomer.addressBook.preferredAddress;

        if ( !empty( customerPreferredAddress ) ) {
            this.context.billing_address = this.getAddressRequestBuilder().build( customerPreferredAddress );
        }

        this.context.billing_address.email = currentCustomer.profile.email;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipping = function( basket ) {
        var currentCustomer = basket.getCustomer();
        var customerPreferredAddress = {};

        this.context.shipping_address.email = basket.customerEmail || '';

        // get default shipment shipping address
        var shipment = getShippment( basket );
        var shippingAddress = shipment.getShippingAddress();

        if ( empty( currentCustomer ) || empty( currentCustomer.profile ) ) {
            if ( empty( shippingAddress ) ) {
                delete this.context.shipping_address;
                return this;
            }

            this.context.shipping_address = this.getAddressRequestBuilder().build( shippingAddress );

            // If we have store pickup as the only address, then we need to use the first & last name form billing
            // as sending store name should not be used
            var storePickUp = !empty( shipment.custom.fromStoreId );
            var billingAddress = basket.getBillingAddress();

            if ( storePickUp && !empty( billingAddress.firstName ) ) {
                this.context.shipping_address.given_name = billingAddress.firstName;
            }

            if ( storePickUp && !empty( billingAddress.lastName ) ) {
                this.context.shipping_address.family_name = billingAddress.lastName;
            }
            this.context.shipping_address.email = basket.customerEmail || '';

            return this;
        }

        if ( shippingAddress ) {
            this.context.shipping_address = this.getAddressRequestBuilder().build( shippingAddress );
            this.context.shipping_address.email =  basket.customerEmail || currentCustomer.profile.email || '';
            return this;
        }

        this.context.shipping_address.phone = currentCustomer.profile.phoneHome;
        this.context.shipping_address.given_name = currentCustomer.profile.firstName;
        this.context.shipping_address.family_name = currentCustomer.profile.lastName;

        customerPreferredAddress = currentCustomer.addressBook.preferredAddress;

        if ( !empty( customerPreferredAddress ) ) {
            this.context.shipping_address = this.getAddressRequestBuilder().build( customerPreferredAddress );
        }
        
        this.context.shipping_address.email =  basket.customerEmail || currentCustomer.profile.email || '';

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildLocale = function( basket ) {
        var localeObject = this.getLocaleObject();
        var currency = basket.getCurrencyCode();

        this.context.purchase_country = localeObject.country;
        this.context.purchase_currency = currency;
        this.context.locale = localeObject.klarnaLocale;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOrderLines = function( basket ) {
        var lineItems = basket.getAllProductLineItems().toArray();
        var giftCertificates = basket.getGiftCertificateLineItems().toArray();
        var giftCertificatePIs = basket.getGiftCertificatePaymentInstruments().toArray();

        var subscription = null;
        
        if (basket.custom.kpSubscriptionPeriod.value && basket.custom.kpSubscriptionFrequency.value) {
            subscription = {
                interval: basket.custom.kpSubscriptionPeriod.value.toUpperCase(),
                interval_count: basket.custom.kpSubscriptionFrequency.value
            }
        }

        this.buildItems( lineItems, subscription, this );

        if ( giftCertificates.length > 0 ) {
            this.buildItems( giftCertificates, subscription, this );
        }

        if ( giftCertificatePIs.length > 0 ) {
            this.buildGCPaymentItems( giftCertificatePIs, this );
        }

        var shipments = basket.shipments;
        this.buildShipments( shipments );

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

        this.context.order_amount = Math.round( totalAmount );

        // Set order discount line items
        if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
            this.addPriceAdjustments( basket.priceAdjustments, null, null, this.context );
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildTotalTax = function( basket ) {
        var totalTax = basket.totalTax.value * 100;
        var salesTaxItem = {};

        this.context.order_tax_amount = Math.round( totalTax );

        if ( isTaxationPolicyNet() ) {
            salesTaxItem = this.getSalesTaxRequestBuilder().build( basket );

            this.context.order_lines.push( salesTaxItem );
        }

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildAdditionalCustomerInfo = function( basket ) {
        this.context.attachment = this.getAdditionalCustomerInfoRequestBuilder().build( basket );

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.buildOptions = function() {
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
            kpRadiusBorder: currentSite.getCustomPreferenceValue( 'kpRadiusBorder' )
        };
        var kpColorCustomizationConfig =  currentSite.getCustomPreferenceValue( 'kpColorCustomization' );
        var options = this.getOptionsRequestBuilder().build( preferences );

        this.context.options = !empty( kpColorCustomizationConfig ) ? JSON.parse ( kpColorCustomizationConfig ) : options;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.validateBuildAmounts = function() {
        var orderAmount = this.context.order_amount;
        var orderTaxAmount = this.context.order_tax_amount;
        var orderLines = this.context.order_lines;
        var orderLinesTotals = 0;
        // Calculate total amount without tax
        for ( var i = 0; i < orderLines.length; i++ ) {
            orderLinesTotals += orderLines[i].total_amount;
        }

        // Check if total amount is equal to order amount incl. tax
        if ( orderAmount !== orderLinesTotals ) {
            Logger.error( 'KlarnaPaymentsSessionRequestBuilder.validateBuildAmounts: Order amount or tax amount DO NOT match.' );
            // Otherwise, adjust order amount and tax amount
            this.context.order_tax_amount = this.context.order_tax_amount + ( orderAmount - orderLinesTotals );
            this.context.order_amount = orderLinesTotals;
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
        this.context.order_lines = requestBuilderHelper.buildItems( items, subscription, null, this );
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

    KlarnaPaymentsSessionRequestBuilder.prototype.buildShipments = function( shipments ) {
        var shipment = {};
        var shippingLineItem = {};

        for ( var i = 0; i < shipments.length; i++ ) {
            shipment = shipments[i];

            if ( shipment.productLineItems.length === 0 ) {
                continue;
            }

            if ( !empty( shipment.shippingMethod ) ) {
                shippingLineItem = this.getShipmentItemRequestBuilder().build( shipment );

                if ( !isOMSEnabled && ( isTaxationPolicyNet() || ( !isTaxationPolicyNet() && discountTaxationMethod === 'price' ) ) ) {
                    this.addPriceAdjustments( shipment.shippingPriceAdjustments.toArray(), null, null );
                }

                this.context.order_lines.push( shippingLineItem );
            }
        }
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

    /**
     * Set the payment intent for the current KlarnaPaymentsSessionRequestBuilder instance based on the provided basket
     * 
     * This method checks if the basket contains subscription data and depending on whether the subscription includes a trial period,
     * sets the payment intent to either 'tokenize' or 'buy_and_default_tokenize'
     * 
     * If the basket does not contain subscription data, the method sets the payment intent to a default value retrieved from the 
     * `subscriptionHelperExtension.getPaymentIntent()` function
     * 
     * @param {Object} basket - The basket object containing the purchase or subscription information
     * @returns {KlarnaPaymentsSessionRequestBuilder} - The instance of KlarnaPaymentsSessionRequestBuilder
     */
    KlarnaPaymentsSessionRequestBuilder.prototype.setPaymentIntent = function( basket ) {
        var subscriptionData = subscriptionHelper.getSubscriptionData( basket );
        var intent = subscriptionHelperExtension.getPaymentIntent( subscriptionData );

        this.context.intent = intent;

        return this;
    };

    KlarnaPaymentsSessionRequestBuilder.prototype.build = function() {
        var basket = this.params.basket;
        var kpIsExpressCheckout = this.params.kpIsExpressCheckout || false;
        var preAssement = isEnabledPreassessmentForCountry( this.getLocaleObject().country );
        var kpAttachmentsPreferenceValue = Site.getCurrent().getCustomPreferenceValue( 'kpEMD' ) ? Site.getCurrent().getCustomPreferenceValue( 'kpEMD' ) : Site.getCurrent().getCustomPreferenceValue( 'kpAttachments' );

        this.init( preAssement, kpIsExpressCheckout );

        this.setMerchantReference( basket );

        this.buildLocale( basket );

        this.setPaymentIntent ( basket );

        if ( preAssement || kpIsExpressCheckout) {
            this.buildBilling( basket );
            this.buildShipping( basket );

            if ( kpAttachmentsPreferenceValue ) {
                this.buildAdditionalCustomerInfo( basket );
            }
        }

        this.buildOrderLines( basket );
        this.buildTotalAmount( basket );
        this.buildTotalTax( basket );
        this.buildOptions();

        // Validate the built data using the context and line items
        this.validateBuildAmounts();

        return this.context;
    };

    module.exports = KlarnaPaymentsSessionRequestBuilder;
}() );
