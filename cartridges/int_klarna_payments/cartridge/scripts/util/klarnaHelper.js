
var Locale = require('dw/util/Locale');
var currentSite = require('dw/system/Site').getCurrent();
var KlarnaConstants = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' );

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
 * Get Klarna Express Checkout Client Key
 *
 * @returns {string} configured client key
 */
function getExpressCheckoutClientKey() {
    var newKlarnaKECKey = getKlarnaClientId();
    if (newKlarnaKECKey) {
        return newKlarnaKECKey;
    }
    var localeObject = getLocale();
    if (Object.keys(localeObject).length > 0) {
        return localeObject.custom.expressCheckoutClientKey || '';
    } else {
        return '';
    }
}

/**
 * @returns {string} concatenated locale string
 */
function getLocaleString() {
    var Locale = require( 'dw/util/Locale' );
    var currentLocale = Locale.getLocale( request.locale );
    var resultLocale = currentLocale.language;
    if ( currentLocale.country ) {
        resultLocale = resultLocale + '-' + currentLocale.country;
    }
    return resultLocale;
}

/**
 * Fetches the Klarna Payments Resources
 *
 * @param {String} countryCode the country fetched from request locale
 * @return {Object} Object containing resources
 */
function getKlarnaResources( countryCode ) {
    var URLUtils = require( 'dw/web/URLUtils' );
    var Resource = require('dw/web/Resource');
    var preAssement = isEnabledPreassessmentForCountry(countryCode) || false;

    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var currentSite = require('dw/system/Site').getCurrent();
    var AdditionalCustomerInfoRequestBuilder = require('*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo');
    var additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();
    var KlarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');

    // klarna payments urls
    var KLARNA_PAYMENT_URLS = KlarnaConstants.KLARNA_PAYMENT_URLS;
    var KPurls = {
        createSession: URLUtils.https( KLARNA_PAYMENT_URLS.CREATE_SESSION ).toString(),
        updateSession: URLUtils.https( KLARNA_PAYMENT_URLS.UPDATE_SESSION ).toString(),
        clearSession: URLUtils.https( KLARNA_PAYMENT_URLS.CLEAR_SESSION ).toString(),
        saveAuth: URLUtils.https( KLARNA_PAYMENT_URLS.SAVE_AUTH ).toString(),
        selectPaymentMethod: URLUtils.https( KLARNA_PAYMENT_URLS.SELECT_PAYMENT_METHOD ).toString(),
        summaryUpdate: URLUtils.https( KLARNA_PAYMENT_URLS.MINISUMMARY_UPDATE ).toString(),
        bankTransferAwaitCallback: URLUtils.https( KLARNA_PAYMENT_URLS.BANK_TRANSFER_AWAIT_CALLBACK ).toString(),
        failOrder: URLUtils.https( KLARNA_PAYMENT_URLS.FAIL_ORDER ).toString(),
        writeLog: URLUtils.https( KLARNA_PAYMENT_URLS.WRITE_ADDITIONAL_LOG ).toString(),
        handleExpressCheckoutAuth: URLUtils.https( KLARNA_PAYMENT_URLS.HANDLE_EXPRESS_CHECKOUT_AUTH ).toString(),
        expressCheckoutAuthCallback: URLUtils.https( KLARNA_PAYMENT_URLS.EXPRESS_CHECKOUT_AUTH_CALLBACK ).toString(),
        generateExpressCheckoutPayload: URLUtils.https(KLARNA_PAYMENT_URLS.GENERATE_EXPRESS_CHECKOUT_PAYLOAD).toString(),
        handleAuthFailurePDP: URLUtils.https(KLARNA_PAYMENT_URLS.HANDLE_AUTH_FAILURE_PDP).toString()
    };

    // klarna payments objects
    var KPObjects = {
        sessionID: currentBasket ? ( currentBasket.custom.kpSessionId ? currentBasket.custom.kpSessionId : null ) : null,
        clientToken: currentBasket ? ( currentBasket.custom.kpClientToken ? currentBasket.custom.kpClientToken : null ) : null,
        preassesment: preAssement,
        kpIsExpressCheckout: currentBasket ? (currentBasket.custom.kpIsExpressCheckout ? currentBasket.custom.kpIsExpressCheckout : false) : false
    };

    // klarna customer information
    var KPCustomerInfo = {
        attachment: currentBasket ? additionalCustomerInfoRequestBuilder.build(currentBasket) : {}
    };

    // klarna constants obj
    var KPConstants = {
        SHIPPING_METHOD_TYPE: KlarnaConstants.SHIPPING_METHOD_TYPE,
        SHIPPING_TYPE: KlarnaConstants.SHIPPING_TYPE,
        KLARNA_PAYMENT_DEFAULT: KlarnaConstants.PAYMENT_METHOD,
        KEC_EEROR_WAITTIME: KlarnaConstants.KLARNA_JS_CONSTANTS.KEC_ERROR_WAITTIME
    };

    //klarna sitePreferences obj
    var KPPreferences = {
        kpUseAlternativePaymentFlow: currentSite.getCustomPreferenceValue('kpUseAlternativePaymentFlow') || false,
        kpAdditionalLogging: currentSite.getCustomPreferenceValue( 'kpLogExtraData' ) ? currentSite.getCustomPreferenceValue( 'kpLogExtraData' ) : currentSite.getCustomPreferenceValue( 'kpAdditionalLogging' ) || false,
        kpExpressCheckoutClientKey: this.getExpressCheckoutClientKey(),
        kpExpressCheckoutTheme: currentSite.getCustomPreferenceValue('kec_theme').value || currentSite.getCustomPreferenceValue('kpECButtonTheme').value,
        kpExpressCheckoutShape: currentSite.getCustomPreferenceValue('kec_shape').value || currentSite.getCustomPreferenceValue('kpECButtonShape').value,
        kpLocale: getLocaleString(),
        kpSignInClientID: KlarnaOSM.getKlarnaSignInClientId(),
        kpSignInEnvironment: KlarnaOSM.getKlarnaSignInEnvironment(),
        kpSignInLocale: KlarnaOSM.getLocale(),
        kpSignInScope: KlarnaOSM.getKlarnaSignInScope(),
        kpSignInButtonShape: KlarnaOSM.getKlarnaSignInButtonShape(),
        kpSignInButtonTheme: KlarnaOSM.getKlarnaSignInButtonTheme(),
        kpSignInButtonLogoAlignment: KlarnaOSM.getKlarnaSignInButtonLogoAlignment(),
        kpSignInRedirectUri: KlarnaOSM.getKlarnaSignInRedirectURL()
    };

    //klarna payment resource messages
    var KPResources = {
        kpExpressCheckoutAuthFailure: Resource.msg('klarna.express.payment.error', 'klarnapayments', null),
        kpExpressSelectStyles: Resource.msg('klarna.express.select.styles', 'klarnapayments', null)
    };

    return {
        KPurls: JSON.stringify( KPurls ),
        KPObjects: JSON.stringify( KPObjects ),
        KPCustomerInfo: JSON.stringify( KPCustomerInfo ),
        KPConstants: JSON.stringify( KPConstants ),
        KPPreferences: JSON.stringify( KPPreferences ),
        KPResources: JSON.stringify( KPResources )
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
function setExpressBilling( cart, klarnaAddress, forceUpdate ) {
    var Transaction = require( 'dw/system/Transaction' );
    var billingAddress = cart.getBillingAddress();

    Transaction.wrap( function() {
        if ( !billingAddress || forceUpdate ) {
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
function setExpressShipping( shipment, klarnaAddress, forceUpdate ) {
    var Transaction = require( 'dw/system/Transaction' );
    var shippingAddress = shipment.getShippingAddress();

    Transaction.wrap( function() {
        if ( !shippingAddress || forceUpdate ) {
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
    });
}

/**
 * Clear klarna session and basket attribute
 * @param  {dw.order.LineItemCtnr} lineItemCtnr basket or order
 */
 function clearSessionRef( lineItemCtnr ) {
    var Transaction = require( 'dw/system/Transaction' );
    var Site = require( 'dw/system/Site' );

    Transaction.wrap( function () {
        session.privacy.KlarnaLocale = null;
        session.privacy.KlarnaPaymentMethods = null;
        session.privacy.SelectedKlarnaPaymentMethod = null;
        session.privacy.KlarnaExpressCategory = null;
        lineItemCtnr.custom.kpSessionId = null;
        lineItemCtnr.custom.kpClientToken = null;
    });
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

/**
 * Map Klarna address to expected in checkout address format
 * @param {Object} customerData customer data
 * @returns {Object} address object
 */
function mapKlarnaExpressAddress(collectedAddress) {
    var addressData = {};
    if (!collectedAddress) {
        return null;
    }
    addressData.firstName = collectedAddress.given_name || '';
    addressData.lastName = collectedAddress.family_name || '';
    addressData.address1 = collectedAddress.street_address || '';
    addressData.address2 = collectedAddress.street_address_2 || '';
    addressData.city = collectedAddress.city || '';
    addressData.postalCode = collectedAddress.postal_code || '';
    addressData.stateCode = collectedAddress.region || '';
    addressData.countryCode = { value: collectedAddress.country || '' };
    addressData.phone = collectedAddress.phone || '';
    addressData.email = collectedAddress.email || '';
    return addressData;
}

/**
 * Read and update Klarna Express Payment Method SitePreference
 * @returns {String} payment method details
*/
function getExpressKlarnaMethod() {
    var paymentMethods = KlarnaConstants.KLARNA_EXPRESS_CATEGORY_CONTENT.KEC_CONTENT;
    var paymentMethod = null;
    if (!empty(paymentMethods)) {
        if (!empty(paymentMethods) && paymentMethods.length > 0) {
            paymentMethod = paymentMethods[0];
        }
    }

    return {
        paymentMethods: JSON.stringify(paymentMethods),
        defaultMethod: paymentMethod ? paymentMethod.identifier : ''
    };
}

/**
 * Get current customer basket details
 * @returns {Object} customerBasketData JSON of priduct and qtys values
*/
function getCurrentBasketProductData(currentBasket) {
    var customerBasketData = {};
    if (!empty(currentBasket)) {
        var productLineItems = currentBasket.productLineItems.toArray();

        var products = [];
        productLineItems.forEach(function (item) {
            products.push({
                productId: item.productID,
                qtyValue: item.quantity.value
            });
            currentBasket.removeProductLineItem(item);
        });
        customerBasketData.products = products;
    }
    return customerBasketData;
}

/**
 * Restore previous customer basket based
 * on the session JSON attribute in case of pay now
 * from PDP
 * @param {Object} currentBasket current basket
*/
function revertCurrentBasketProductData(currentBasket) {
    var Transaction = require('dw/system/Transaction');
    var app = require('*/cartridge/scripts/app');
    var Product = app.getModel('Product');
    var params = request.httpParameterMap;
    var Logger = require('dw/system/Logger');

    try {
        Transaction.begin();

        if (!empty(currentBasket)) {

            var cart = app.getModel('Cart').get();

            var customerBasketData = session.privacy.kpCustomerProductData ? JSON.parse(session.privacy.kpCustomerProductData) : null;
            var productLineItems = currentBasket.productLineItems.toArray();


            productLineItems.forEach(function (item) {
                currentBasket.removeProductLineItem(item);
            });


            var products = (customerBasketData && customerBasketData.products) ? customerBasketData.products : null;
            if (products) {
                products.forEach(function (product) {
                    var productToAdd = Product.get(product.productId);
                    var productOptionModel = productToAdd.updateOptionSelection(params);
                    cart.addProductItem(productToAdd.object, product.qtyValue, productOptionModel);
                });
            }
            cart.calculate();

            session.privacy.kpCustomerProductData = null;
        }
        Transaction.commit();
    } catch (e) {
        Transaction.rollback();
        Logger.error("Couldn't restore customer basket");
    }
}

//read arguments and return object
function getActivationObjectAttrValue() {
    const args = Array.from(arguments);
    var countryCode = Locale.getLocale(request.locale).country;
    var activationKey = session.privacy['kpActivationKey_' + countryCode];
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var activationObject = CustomObjectMgr.getCustomObject('KlarnaActivation', activationKey);
    var attrValues = {};
    if (activationObject) {
        for (var i = 0; i < args.length; i++) {
            let attrId = args[i];
            attrValues[attrId] = activationObject.custom[attrId];
        }
    }
    return attrValues;
}

// retrieve kpVCNEnabled from Klarna Activation
// Custom object or site preferences
function isVCNEnabled() {
    var isVCNEnabled = false;
    var countryCode = Locale.getLocale(request.locale).country;
    var isKlarnaActive = session.privacy['kpActive_' + countryCode];
    if (!isKlarnaActive) {
        return isVCNEnabled;
    }
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        isVCNEnabled = getActivationObjectAttrValue('kpVCNEnabled_countries').kpVCNEnabled_countries;
    } else {
        isVCNEnabled = currentSite.getCustomPreferenceValue('kpVCNEnabled');
    }
    return isVCNEnabled;
}

// retrieve kpVCNkeyId from Klarna Activation
// Custom object or site preferences
function getVCNKeyId() {
    var vcnKeyId = null;
    var countryCode = Locale.getLocale(request.locale).country;
    var isKlarnaActive = session.privacy['kpActive_' + countryCode];
    if (!isKlarnaActive) {
        return vcnKeyId;
    }
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        vcnKeyId = getActivationObjectAttrValue('kpVCNkeyId_countries').kpVCNkeyId_countries;
    } else {
        vcnKeyId = currentSite.getCustomPreferenceValue('kpVCNkeyId');
    }
    return vcnKeyId;
}

// retrieve VCNRetryEnabled from Klarna Activation
// Custom object or site preferences
function isVCNSettlementRetry() {
    var kpVCNRetryEnabled = false;
    var countryCode = Locale.getLocale(request.locale).country;
    var isKlarnaActive = session.privacy['kpActive_' + countryCode];
    if (!isKlarnaActive) {
        return kpVCNRetryEnabled;
    }
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        kpVCNRetryEnabled = getActivationObjectAttrValue('kpVCNRetry_countries').kpVCNRetry_countries;
    } else {
        kpVCNRetryEnabled = currentSite.getCustomPreferenceValue( 'kpVCNRetry' ) ?  currentSite.getCustomPreferenceValue( 'kpVCNRetry' ) : currentSite.getCustomPreferenceValue( 'kpVCNRetryEnabled' );
    }
    return kpVCNRetryEnabled;
}

// retrieve client id from Klarna Activation
// Custom object or site preferences
function getKlarnaClientId() {
    var clientId = null;
    var countryCode = Locale.getLocale(request.locale).country;
    var isKlarnaActive = session.privacy['kpActive_' + countryCode];
    if (!isKlarnaActive) {
        return clientId;
    }
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        clientId = getActivationObjectAttrValue('kp_client_id_countries').kp_client_id_countries;
    } else if (kpAcativationSource === 'KlarnaActivation_SP') {
        clientId = currentSite.getCustomPreferenceValue('KP_client_id');
    }
    return clientId;
}

// return service url based on Klarna environment and region
function getServiceURL(region) {
    var regionEndpoint = KlarnaConstants.KLARNA_ENDPOINTS[region];
    return regionEndpoint[getKlarnaEnvironment()];
}

//get Klarna environment from site preferences
function getKlarnaEnvironment() {
    var kpEnvironmentTest = currentSite.getCustomPreferenceValue('KP_environment');
    return kpEnvironmentTest ? KlarnaConstants.KLARNA_ENVIRONMENTS.PLAYGROUND : KlarnaConstants.KLARNA_ENVIRONMENTS.PRODUCTION;
}

// fetch region code from Klarna Activation
function getRegionCode() {
    var countryCode = Locale.getLocale(request.locale).country;
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    var region = null;
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        var attrValue = getActivationObjectAttrValue('kp_region_countries');
        region = attrValue.kp_region_countries ? attrValue.kp_region_countries.value : null;
    } else if (kpAcativationSource === 'KlarnaActivation_SP') {
        region = currentSite.getCustomPreferenceValue('KP_Region').value;
    }
    return region ? region.toLowerCase() : null;
}

// retrieve the Klarna API credentials for current country
// from Klarna Activation custom object
// or Klarna Activation Site Preferences
// if not found - service credentials should be used
function getKlarnaServiceCredentials() {
    var countryCode = Locale.getLocale(request.locale).country;
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO') {
        var attrValues = getActivationObjectAttrValue('KP_API_Username_countries', 'KP_API_Password_countries', 'kp_region_countries');
        return {
            useServiceCredentials: false,
            apiUsername: attrValues.KP_API_Username_countries,
            apiPassword: attrValues.KP_API_Password_countries,
            apiURL: getServiceURL(attrValues.kp_region_countries.value)
        }
    } else if (kpAcativationSource === 'KlarnaActivation_SP') {
        var apiUsername = currentSite.getCustomPreferenceValue('KP_API_Username');
        var apiPassword = currentSite.getCustomPreferenceValue('KP_API_Password');
        var region = currentSite.getCustomPreferenceValue('KP_Region').value;
        if (!apiUsername || !apiPassword || !region) {
            return {
                useServiceCredentials: true
            };
        }
        return {
            useServiceCredentials: false,
            apiUsername: apiUsername,
            apiPassword: apiPassword,
            apiURL: getServiceURL(region)
        }
    }
    return {
        useServiceCredentials: true
    };
}

// retrieve the Klarna SignIn service url
// dynamically if activation entry found
// if not found - service credentials should be used
function getKlarnaSignInServiceCredentials() {
    var countryCode = Locale.getLocale(request.locale).country;
    var kpAcativationSource = session.privacy['kpActivationSource_' + countryCode];
    if (kpAcativationSource === 'KlarnaActivation_CO' || kpAcativationSource === 'KlarnaActivation_SP') {
        return {
            useServiceCredentials: false,
            apiURL: getServiceURL('LOGIN')
        }
    }
    return {
        useServiceCredentials: true
    };
}

// retrieve the configuration data for current country
// from Klarna Activation custom object
// or Klarna Activation Site Preferences
function retrieveKlarnaCountriesData(countryCode) {
    var CustomObjectMgr = require('dw/object/CustomObjectMgr');
    var kpEnabled = currentSite.getCustomPreferenceValue('kp_enable');

    if (!countryCode) {
        return {
            configFound: false
        };
    }

    var activationObject = CustomObjectMgr.queryCustomObject('KlarnaActivation', 'custom.kp_market_countries LIKE {0}', countryCode);
    if (activationObject) {
        return {
            configFound: kpEnabled,
            source: 'KlarnaActivation_CO',
            activationId: activationObject.custom.kp_activation_key
        };
    }

    //check preferences
    var klarnaMarkets = currentSite.getCustomPreferenceValue('KP_Market');
    var activationMarket = klarnaMarkets.find(function (market) {
        if (market.value === countryCode) {
            return market;
        }
    });
    if (activationMarket) {
        return {
            configFound: kpEnabled,
            source: 'KlarnaActivation_SP'
        };

    }
    activationObject = getLocale();
    if (Object.keys(activationObject).length !== 0 && activationObject.custom.coFound) {
        return {
            configFound: true,
            source: 'KlarnaCountries_CO'
        };
    }

    return {
        configFound: false
    };
}

// check if there is a configuration data
// for current country in Klarna Activation custom object
// or Klarna Activation Site Preferences
// or Klarna Countries Custom object
// store the configuration source in session for future usage
function isCurrentCountryKlarnaEnabled() {
    var countryCode = Locale.getLocale(request.locale).country;
    var klarnaEnabled = session.privacy['kpActive_' + countryCode];
    if (klarnaEnabled !== null) {
        return klarnaEnabled;
    }
    var countryData = retrieveKlarnaCountriesData(countryCode);
    if (countryData && countryData.configFound) {
        session.privacy['kpActive_' + countryCode] = true;
        session.privacy['kpActivationSource_' + countryCode] = countryData.source;
        if (countryData.activationId) {
            session.privacy['kpActivationKey_' + countryCode] = countryData.activationId;
        }
        return true;
    } else {
        session.privacy['kpActive_' + countryCode] = false;
        session.privacy['kpActivationSource_' + countryCode] = null;
        session.privacy['kpActivationKey_' + countryCode] = null;
        return false;
    }

}

/**
 * Verify if the address already exists as a stored user address
 * @param {dw.order.OrderAddress} address - Object that contains shipping address
 * @param {Object[]} storedAddress - Stored user address
 * @returns {boolean} - Boolean indicating if the address already exists
 */
function checkIfAddrFoundInAddrBook( addressToAdd, storedAddress ) {
    if ( storedAddress.address1 === addressToAdd.address1
        && storedAddress.postalCode === addressToAdd.postalCode
        && storedAddress.firstName === addressToAdd.firstName
        && storedAddress.lastName === addressToAdd.lastName ) {
        return true;
    }
    return false;
}

exports.calculateOrderTotalValue = calculateOrderTotalValue;
exports.getKlarnaPaymentMethodName = getKlarnaPaymentMethodName;
exports.getDiscountsTaxation = getDiscountsTaxation;
exports.isTaxationPolicyNet = isTaxationPolicyNet;
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
exports.getExpressCheckoutClientKey = getExpressCheckoutClientKey;
exports.mapKlarnaExpressAddress = mapKlarnaExpressAddress;
exports.getExpressKlarnaMethod = getExpressKlarnaMethod;
exports.getCurrentBasketProductData = getCurrentBasketProductData;
exports.revertCurrentBasketProductData = revertCurrentBasketProductData;
exports.getLocaleString = getLocaleString;
exports.isCurrentCountryKlarnaEnabled = isCurrentCountryKlarnaEnabled;
exports.getKlarnaServiceCredentials = getKlarnaServiceCredentials;
exports.getKlarnaClientId = getKlarnaClientId;
exports.isVCNEnabled = isVCNEnabled;
exports.getVCNKeyId = getVCNKeyId;
exports.isVCNSettlementRetry = isVCNSettlementRetry;
exports.getKlarnaEnvironment = getKlarnaEnvironment;
exports.getRegionCode = getRegionCode;
exports.checkIfAddrFoundInAddrBook = checkIfAddrFoundInAddrBook;
exports.getKlarnaSignInServiceCredentials = getKlarnaSignInServiceCredentials;