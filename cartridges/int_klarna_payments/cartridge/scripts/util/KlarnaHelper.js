/**
 * Calculate order total value for a basket.
 * 
 * @param {dw.order.Basket} basket the basket to calculate the order total value.
 * @return {dw.value.Money} total order value.
 */
function calculateOrderTotalValue( basket ) {
    // calculate the amount to be charged for the
    // non-gift certificate payment instrument
    var Utils = require( '*/cartridge/scripts/checkout/Utils' );

    var orderTotalValue = null;

    if ( basket.totalGrossPrice.available ) {
        orderTotalValue = Utils.calculateNonGiftCertificateAmount( basket );
    } else {
        orderTotalValue = basket.getAdjustedMerchandizeTotalPrice( true ).add( basket.giftCertificateTotalPrice );
    }

    return orderTotalValue;
}

/**
 * Return Klarna Payment Method name.
 *
 * @returns {string} Klarna Payment Method name.
 */
function getKlarnaPaymentMethodName() {
    var PaymentMgr = require( 'dw/order/PaymentMgr' );
    var KlarnaPaymentsConstants = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' );
    var paymentMethodId = KlarnaPaymentsConstants.PAYMENT_METHOD;

    var paymentMethod = PaymentMgr.getPaymentMethod( paymentMethodId );

    return paymentMethod.getName();
}

/**
 * Returns the selected discounts taxation method.
 * Should have the same value as "Merchant Tools > Site Preferences > Promotions > Discount Taxation"
 * 
 * @return {string} the selected discounts taxation method
 */
function getDiscountsTaxation() {
    return dw.system.Site.getCurrent().getCustomPreferenceValue( 'kpPromoTaxation' ).value;
}

/**
 * Checks if site's taxation policy is Net.
 *
 * @return {Boolean} true, if policy is Net, false if Gross.
 */
function isTaxationPolicyNet() {
    var TaxMgr = require( 'dw/order/TaxMgr' );
    return ( TaxMgr.getTaxationPolicy() === TaxMgr.TAX_POLICY_NET );
}

/**
 * Checks if payment options should be displayed, hidden or grayed out when hard reject from Klarna is received.
 * Value of "kpRejectedMethodDisplay" determines if the method will be displayed - If set to value other than "No", 
 * the Klarna payment method options on the checkout will be greyed out/ not displayed to customer in the current 
 * view when Klarna authorization request is rejected in the response (.i.e hard reject - "show_form" and "approved" 
 * are both "false")
 * 
 * @returns {string} the selectd mode of payment method with hard reject
 */
function hideRejectedPayments() {
    return dw.system.Site.getCurrent().getCustomPreferenceValue( 'kpRejectedMethodDisplay' ).value;
}

/**
 * Returns the Klarna email message
 * 
 * @return {string} the Klarna message
 */
function getConfirmationEmailAsset() {
    var ContentMgr = require( 'dw/content/ContentMgr' );
    var apiContent = ContentMgr.getContent( 'klarna-email-info' );
    return ( apiContent && apiContent.custom && apiContent.custom.body ) || '';
}

/**
 * Sets additional payment information
 * 
 * @param {dw.order.PaymentInstrument} paymentInstrument newly created payment instrument.
 * @return {dw.order.PaymentInstrument} the updated payment instrument.
 */
function setPaymentCategoryDetails( paymentInstrument ) {
    if ( !empty( paymentInstrument ) ) {
        var currentCookies = request.getHttpCookies();
        if ( currentCookies.hasOwnProperty( 'selectedKlarnaPaymentCategory' ) ) {
            var paymentCategoryID = currentCookies.selectedKlarnaPaymentCategory.value;
            var paymentCategoryName = '';
            var klarnaPaymentMethods = JSON.parse( session.privacy.KlarnaPaymentMethods );

            if ( !empty( klarnaPaymentMethods ) ) {
                klarnaPaymentMethods.forEach( function( item ) {
                    if ( item.identifier === paymentCategoryID ) {
                        paymentCategoryName = item.name;
                        return;
                    }
                } );
            }

            paymentInstrument.custom.klarnaPaymentCategoryID = paymentCategoryID;
            paymentInstrument.custom.klarnaPaymentCategoryName = paymentCategoryName;
        }
    }

    return paymentInstrument;
}

/**
 * Retrieve the default shipment for the basket/order. In case we have multi-shipment, we will return 
 * the first home or pickup address. If we only have gift cards in the bag - we return null
 *
 * @param {dw.order.LineItemCtnr} lineItemCtnr the basket/order
 * @return {dw.order.Shipment} the default shipment
 */
function getShippment( lineItemCtnr ) {
    var shipments = lineItemCtnr.getShipments();
    var defaultShipment = lineItemCtnr.getDefaultShipment();

    if ( shipments.length > 1 ) {
        for ( var i = 0; i < shipments.length; i++ ) {
            var shipment = shipments[i];

            // Return the first home delivery address that can be found.
            // In some cases of store pickup, the default shipment is home delivery that doesn't have any items assigned, 
            // so we only want those with items regardless of home or pickup
            if ( shipment.productLineItems.length > 0 ) {
                return shipment;
            }
        }
    }

    // Return the shipment only if we have physical items, we don't want shipment to be returned for gift certificates
    return ( !empty( defaultShipment ) && defaultShipment.productLineItems.length > 0 ) ? defaultShipment : null;
}

/**
 * Converts null to empty string.
 *
 * @param {Object} obj of any kind.
 * @return {string} the result
 */
function strval( obj ) {
    if ( obj === null ) {
        return '';
    }

    return obj;
}

/**
 * Checks whether a country code maps to a Country in Europe.
 *
 * @param {string} country two-letter country code.
 * @returns {bool} true, if country is in Europe.
 */
function isPreAssementApplicable( country ) {
    var isInList = true;
    var countriesList = "BE, BG, CZ, DK, DE, EE, IE, EL, ES, FR, HR, IT, CY, LV, LT, LU, HU, MT, NL, AT, PL, PT, RO, SI, SK, FI, SE, UK, GB, US, CH, NO, CA, AU, NZ";

    if( countriesList.indexOf( country ) > -1 ) {
        isInList = false;
    }

    return isInList;
}

/**
 * Checks whether Preassessment preference is activated for a country.
 *
 * @param {string} country 2-letter country code.
 * @returns {bool} true, if preassessment is on for this country.
 */
function isEnabledPreassessmentForCountry( country ) {
    var isPreassessment = false;

    if ( isPreAssementApplicable( country ) ) {
        isPreassessment = true;
    }

    return isPreassessment;
}

/**
 * Fetches the Klarna Payments Resources
 *
 * @param {String} countryCode the country fetched from request locale
 * @return {Object} Object containing resources
 */
function getKlarnaResources( countryCode ) {
    var URLUtils = require( 'dw/web/URLUtils' );
    var KlarnaConstants = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' );
    var hideRejectedPaymentsValue = hideRejectedPayments();
    var preAssement = isEnabledPreassessmentForCountry( countryCode ) || false;

    var BasketMgr = require( 'dw/order/BasketMgr' );
    var currentBasket = BasketMgr.getCurrentBasket();
    var AdditionalCustomerInfoRequestBuilder = require( '*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo' );
    var additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();

    // klarna payments urls
    var KLARNA_PAYMENT_URLS = KlarnaConstants.KLARNA_PAYMENT_URLS;
    var KPurls = {
        createSession: URLUtils.https( KLARNA_PAYMENT_URLS.CREATE_SESSION ).toString(),
        updateSession: URLUtils.https( KLARNA_PAYMENT_URLS.UPDATE_SESSION ).toString(),
        clearSession: URLUtils.https( KLARNA_PAYMENT_URLS.CLEAR_SESSION ).toString(),
        saveAuth: URLUtils.https( KLARNA_PAYMENT_URLS.SAVE_AUTH ).toString(),
        selectPaymentMethod: URLUtils.https( KLARNA_PAYMENT_URLS.SELECT_PAYMENT_METHOD ).toString()
    };

    // klarna payments objects
    var KPObjects = {
        sessionID: session.privacy.KlarnaPaymentsSessionID ? session.privacy.KlarnaPaymentsSessionID.toString() : null,
        clientToken: session.privacy.KlarnaPaymentsClientToken ? session.privacy.KlarnaPaymentsClientToken.toString() : null,
        preassesment: preAssement,
        hideRejectedPayments: hideRejectedPaymentsValue
    };

    // klarna customer information
    var KPCustomerInfo = {
        attachment: additionalCustomerInfoRequestBuilder.build( currentBasket ) || {}
    };

    var KPConstants = {
        SHIPPING_METHOD_TYPE: KlarnaConstants.SHIPPING_METHOD_TYPE,
        SHIPPING_TYPE: KlarnaConstants.SHIPPING_TYPE
    };

    return {
        KPurls: JSON.stringify( KPurls ),
        KPObjects: JSON.stringify( KPObjects ),
        KPCustomerInfo: JSON.stringify( KPCustomerInfo ),
        KPConstants: JSON.stringify( KPConstants )
    }
}

exports.calculateOrderTotalValue = calculateOrderTotalValue;
exports.getKlarnaPaymentMethodName = getKlarnaPaymentMethodName;
exports.getDiscountsTaxation = getDiscountsTaxation;
exports.isTaxationPolicyNet = isTaxationPolicyNet;
exports.hideRejectedPayments = hideRejectedPayments;
exports.getConfirmationEmailAsset = getConfirmationEmailAsset;
exports.setPaymentCategoryDetails = setPaymentCategoryDetails;
exports.getShippment = getShippment;
exports.isPreAssementApplicable = isPreAssementApplicable;
exports.isEnabledPreassessmentForCountry = isEnabledPreassessmentForCountry;
exports.getKlarnaResources = getKlarnaResources;
exports.strval = strval;
