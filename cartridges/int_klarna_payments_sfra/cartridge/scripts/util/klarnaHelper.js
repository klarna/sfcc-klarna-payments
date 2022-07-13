/* globals empty, session, request, dw */

'use strict';

var superMdl = module.superModule;
var Site = require('dw/system/Site');
/**
 * Returns shipment if it contains store ID or returns the default shipment
 *
 * @param  {dw.order.LineItemCtnr} lineItemCtnr basket or order
 * @returns {dw.order.Shipment} shipment object
 */
superMdl.getShippment = function (lineItemCtnr) {
    var shipments = lineItemCtnr.getShipments();

    if (shipments.length > 1) {
        for (var i = 0; i < shipments.length; i++) {
            var shipment = shipments[i];

            // return the first home delivery address that can be found
            if (empty(shipment.custom.fromStoreId)) {
                return shipment;
            }
        }
    }

    return lineItemCtnr.getDefaultShipment();
};

/**
 * Clear klarna session and basket attribute
 * @param  {dw.order.LineItemCtnr} lineItemCtnr basket or order
 */
superMdl.clearSessionRef = function (lineItemCtnr) {
    var Transaction = require('dw/system/Transaction');
    if (Site.getCurrent().getCustomPreferenceValue('kpCreateNewSessionWhenExpires')) {
        Transaction.wrap(function () {
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
 * Fetches the Klarna Payments Resources
 *
 * @return {Object} Object containing resources
 */
superMdl.getKlarnaResources = function () {
    var URLUtils = require('dw/web/URLUtils');
    var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');
    var Countries = require('*/cartridge/scripts/util/countries');
    var country = Countries.getCurrent({ CurrentRequest: request }).countryCode;
    var preassess = this.isEnabledPreassessmentForCountry(country);
    var hideRejectedPaymentsValue = this.hideRejectedPayments();

    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var AdditionalCustomerInfoRequestBuilder = require('*/cartridge/scripts/payments/requestBuilder/additionalCustomerInfo');
    var additionalCustomerInfoRequestBuilder = new AdditionalCustomerInfoRequestBuilder();

    // klarna payments urls
    var KLARNA_PAYMENT_URLS = KlarnaPaymentsConstants.KLARNA_PAYMENT_URLS;
    var KPurls = {
        refreshSession: URLUtils.https(KLARNA_PAYMENT_URLS.UPDATE_SESSION).toString(),
        saveAuth: URLUtils.https(KLARNA_PAYMENT_URLS.SAVE_AUTH).toString(),
        loadAuth: URLUtils.https(KLARNA_PAYMENT_URLS.LOAD_AUTH).toString(),
        selectPaymentMethod: URLUtils.https(KLARNA_PAYMENT_URLS.SELECT_PAYMENT_METHOD).toString()
    };

    // klarna payments objects
    var KPObjects = {
        sessionID: currentBasket.custom.kpSessionId ? currentBasket.custom.kpSessionId : null,
        clientToken: currentBasket.custom.kpClientToken ? currentBasket.custom.kpClientToken : null,
        preassesment: preassess,
        hideRejectedPayments: hideRejectedPaymentsValue
    };

    // klarna customer information
    var KPCustomerInfo = {
        attachment: additionalCustomerInfoRequestBuilder.build(currentBasket) || {}
    };

    // klarna constants obj
    var KPConstants = {
        SHIPPING_METHOD_TYPE: KlarnaPaymentsConstants.SHIPPING_METHOD_TYPE,
        SHIPPING_TYPE: KlarnaPaymentsConstants.SHIPPING_TYPE
    };

    // klarna sitePreferences obj
    var KPPreferences = {
        kpUseAlternativePaymentFlow: Site.getCurrent().getCustomPreferenceValue('kpUseAlternativePaymentFlow') || false
    };

    return {
        KPurls: JSON.stringify(KPurls),
        KPObjects: JSON.stringify(KPObjects),
        KPCustomerInfo: JSON.stringify(KPCustomerInfo),
        KPConstants: JSON.stringify(KPConstants),
        KPPreferences: JSON.stringify(KPPreferences)
    };
};

/**
 * Filters the applicable shipping methods by address
 *
 * @param {dw.order.Shipment} shipment SFCC shipment
 * @param {dw.order.OrderAddress} address The Klarna address
 * @return {dw.util.ArrayList} filteredMethods List of shipment methods
 */
function filterApplicableShippingMethods(shipment, address) {
    var addressObj = superMdl.convAddressObj(address);
    var allShippingMethods = superMdl.getAppplicableShippingMethods(shipment, addressObj);
    var collections = require('*/cartridge/scripts/util/collections');
    var ShippingMethodModel = require('*/cartridge/models/shipping/shippingMethod');

    var filteredMethods = new dw.util.ArrayList();
    collections.forEach(allShippingMethods, function (shippingMethod) {
        if (shipment.custom.fromStoreId && shippingMethod.custom.storePickupEnabled) {
            filteredMethods.push(new ShippingMethodModel(shippingMethod, shipment));
        } else if (!shipment.custom.fromStoreId && !shippingMethod.custom.storePickupEnabled) {
            filteredMethods.push(new ShippingMethodModel(shippingMethod, shipment));
        }
    });

    return filteredMethods;
}

superMdl.filterApplicableShippingMethods = filterApplicableShippingMethods;

module.exports = superMdl;
