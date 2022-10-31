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
    var paymentMethodId = getPaymentMethod();

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
 * Checks whether a country code falls under the PII/Privacy concerns across markets.
 * If a country does not falls under the PII concern - sensitive information (i.e. billing & 
 * shipping data) will be sent with the initial session request.
 *
 * @param {string} country two-letter country code.
 * @returns {bool} true, if the country is not PII sensitive.
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
        selectPaymentMethod: URLUtils.https( KLARNA_PAYMENT_URLS.SELECT_PAYMENT_METHOD ).toString(),
        summaryUpdate: URLUtils.https( KLARNA_PAYMENT_URLS.MINISUMMARY_UPDATE ).toString()
    };

    // klarna payments objects
    var KPObjects = {
        sessionID: currentBasket.custom.kpSessionId ? currentBasket.custom.kpSessionId : null,
        clientToken: currentBasket.custom.kpClientToken ? currentBasket.custom.kpClientToken : null,
        preassesment: preAssement,
        hideRejectedPayments: hideRejectedPaymentsValue
    };

    // klarna customer information
    var KPCustomerInfo = {
        attachment: additionalCustomerInfoRequestBuilder.build( currentBasket ) || {}
    };

    // klarna constants obj
    var KPConstants = {
        SHIPPING_METHOD_TYPE: KlarnaConstants.SHIPPING_METHOD_TYPE,
        SHIPPING_TYPE: KlarnaConstants.SHIPPING_TYPE,
        KLARNA_PAYMENT_DEFAULT: KlarnaConstants.PAYMENT_METHOD
    };

    //klarna sitePreferences obj
    var KPPreferences = {
        kpUseAlternativePaymentFlow: dw.system.Site.getCurrent().getCustomPreferenceValue( 'kpUseAlternativePaymentFlow' ) || false
    };

    return {
        KPurls: JSON.stringify( KPurls ),
        KPObjects: JSON.stringify( KPObjects ),
        KPCustomerInfo: JSON.stringify( KPCustomerInfo ),
        KPConstants: JSON.stringify( KPConstants ),
        KPPreferences: JSON.stringify( KPPreferences )
    }
}

/**
 * Converts address to object
 *
 * @param {dw.order.OrderAddress} address The Klarna or SFCC address
 * @return {Object} addressObj The converted address
 */
function convAddressObj( address ) {
    var addressObj;

    if ( address instanceof dw.order.OrderAddress ) {
        addressObj = {
            firstName: address.firstName,
            lastName: address.lastName,
            address1: address.address1,
            address2: address.address2,
            city: address.city,
            postalCode: address.postalCode,
            stateCode: address.stateCode,
            countryCode: address.countryCode.value
        };
    } else if ( address instanceof Object ) {
        addressObj = address;
    }

    return addressObj;
}

/**
 * Retrieves the applicable shipping methods by address
 *
 * @param  {dw.order.Shipment} shipment SFCC shipment
 * @param  {dw.order.OrderAddress} address the Klarna address
 * @returns {dw.util.ArrayList} applicableShippingMethods List of shipping methods
 */
function getAppplicableShippingMethods( shipment, address ) {
    var ShippingMgr = require( 'dw/order/ShippingMgr' );

    var shipmentModel = ShippingMgr.getShipmentShippingModel( shipment );
    var applicableShippingMethods = address ? shipmentModel.getApplicableShippingMethods( address ) :
        shipmentModel.applicableShippingMethods;

    return applicableShippingMethods;
}

/**
 * Filters the applicable shipping methods by address
 *
 * @param  {dw.order.Shipment} shipment SFCC shipment
 * @param  {dw.order.OrderAddress} address the Klarna address
 * @return {dw.util.ArrayList} filteredMethods Llist of shipment methods
 */
function filterApplicableShippingMethods( shipment, address ) {
    var addressObj = convAddressObj( address );
    var allShippingMethods = getAppplicableShippingMethods( shipment, addressObj );
    var filteredMethods = new dw.util.ArrayList();

    var shippingMethod;
    for ( var i = 0; i < allShippingMethods.length; i++ ) {
        shippingMethod = allShippingMethods[i];
        if ( shipment.custom.fromStoreId && shippingMethod.custom.storePickupEnabled ) {
            filteredMethods.push( shippingMethod );
        } else if ( !shipment.custom.fromStoreId && !shippingMethod.custom.storePickupEnabled ) {
            filteredMethods.push( shippingMethod );
        }
    }

    return filteredMethods;
}

/**
 * Retrieves the Express Button form details
 * 
 * @param {dw.web.Form} expressForm The express form definition
 * @return {Object} klarnaDetails The KEB details
 */
function getExpressFormDetails( expressForm ) {
    var klarnaDetails = {
        email: expressForm.email.value || '',
        phone: expressForm.phone.value || '',
        firstName: expressForm.firstName.value || '',
        lastName: expressForm.lastName.value || '',
        address1: expressForm.address1.value || '',
        address2: expressForm.address2.value || '',
        city: expressForm.city.value || '',
        stateCode: expressForm.stateCode.value || '',
        postalCode: expressForm.postalCode.value || '',
        countryCode: {value: expressForm.countryCode.value.toLowerCase() || ''}
    };

    return klarnaDetails;
}

/**
 * Sets the cart billing address to Klarna one
 *
 * @param {dw.order.LineItemCtnr} cart SFCC LineItemCtnr
 * @param {Object} klarnaAddress The Klarna address
 * @return {void}
 */
function setExpressBilling( cart, klarnaAddress ) {
    var Transaction = require( 'dw/system/Transaction' );
    var billingAddress = cart.getBillingAddress();

    Transaction.wrap( function() {
        if ( !billingAddress ) {
            billingAddress = cart.createBillingAddress();
        }

        billingAddress.setFirstName( klarnaAddress.firstName );
        billingAddress.setLastName( klarnaAddress.lastName );
        billingAddress.setAddress1( klarnaAddress.address1 );
        billingAddress.setAddress2( klarnaAddress.address2 );
        billingAddress.setCity( klarnaAddress.city );
        billingAddress.setPostalCode( klarnaAddress.postalCode );
        billingAddress.setStateCode( klarnaAddress.stateCode );
        billingAddress.setCountryCode( klarnaAddress.countryCode.value );
        billingAddress.setPhone( klarnaAddress.phone );

        cart.setCustomerEmail( klarnaAddress.email );
    } );
}

/**
 * Sets the Klarna address to shipment
 *
 * @param  {dw.order.Shipment} shipment SFCC Shipment
 * @param  {Object} klarnaAddress the Klarna address
 * @returns {void}
 */
function setExpressShipping( shipment, klarnaAddress ) {
    var Transaction = require( 'dw/system/Transaction' );
    var shippingAddress = shipment.getShippingAddress();

    Transaction.wrap( function() {
        if ( !shippingAddress ) {
            shippingAddress = shipment.createShippingAddress();

            shippingAddress.setFirstName( klarnaAddress.firstName );
            shippingAddress.setLastName( klarnaAddress.lastName );
            shippingAddress.setAddress1( klarnaAddress.address1 );
            shippingAddress.setAddress2( klarnaAddress.address2 );
            shippingAddress.setCity( klarnaAddress.city );
            shippingAddress.setPostalCode( klarnaAddress.postalCode );
            shippingAddress.setStateCode( klarnaAddress.stateCode );
            shippingAddress.setCountryCode( klarnaAddress.countryCode.value );
            shippingAddress.setPhone( klarnaAddress.phone );
        }
    } );
}

/**
 * Clear klarna session and basket attribute
 * @param  {dw.order.LineItemCtnr} lineItemCtnr basket or order
 */
 function clearSessionRef( lineItemCtnr ) {
    var Transaction = require( 'dw/system/Transaction' );
    var Site = require( 'dw/system/Site' );

    if ( Site.getCurrent().getCustomPreferenceValue( 'kpCreateNewSessionWhenExpires' ) ) {
        Transaction.wrap( function () {
            session.privacy.KlarnaLocale = null;
            session.privacy.KlarnaPaymentMethods = null;
            session.privacy.SelectedKlarnaPaymentMethod = null;
            session.privacy.KlarnaExpressCategory = null;
            lineItemCtnr.custom.kpSessionId = null;
            lineItemCtnr.custom.kpClientToken = null;
        });
    }
};

/**
 * Is OMS enabled
 */
 function isOMSEnabled() {
    return dw.system.Site.getCurrent().getCustomPreferenceValue( 'kpOMSEnabled' );
}
/**
 * Gets Klarna Payments Locale object
 *
 * @param {string} currentCountry current country locale
 *
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
function getLocale( currentCountry ) {
    var localeObject = {};
    var getKlarnaPaymentsLocale = require( '*/cartridge/scripts/locale/klarnaPaymentsGetLocale' );
    var localeObjectResult = getKlarnaPaymentsLocale.getLocaleObject( currentCountry );
    if ( localeObjectResult.success ) {
        localeObject = localeObjectResult.localeObject;
    }
    return localeObject;
}
/**
 * Gets Klarna Payments Method from custom object
 *
 * @param {string} currentCountry current country locale
 *
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
function getPaymentMethod( ) {
    var localeObject = getLocale();
    var PAYMENT_METHOD = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).PAYMENT_METHOD;
    if (isOMSEnabled() && !empty(localeObject) && !empty(localeObject.custom.paymentMethodID) && localeObject.custom.paymentMethodID != '') {
        PAYMENT_METHOD = localeObject.custom.paymentMethodID;
    }
    return PAYMENT_METHOD;
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
exports.convAddressObj = convAddressObj;
exports.getAppplicableShippingMethods = getAppplicableShippingMethods;
exports.filterApplicableShippingMethods = filterApplicableShippingMethods;
exports.getExpressFormDetails = getExpressFormDetails;
exports.setExpressBilling = setExpressBilling;
exports.setExpressShipping = setExpressShipping;
exports.strval = strval;
exports.clearSessionRef = clearSessionRef;
exports.isOMSEnabled = isOMSEnabled;
exports.getLocale = getLocale;
exports.getPaymentMethod = getPaymentMethod;
