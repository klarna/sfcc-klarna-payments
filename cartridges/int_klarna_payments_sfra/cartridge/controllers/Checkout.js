/* globals session, request, customer */
/* eslint-disable sitegenesis/no-global-require */

'use strict';

var page = module.superModule; // inherits functionality
var server = require('server');

server.extend(page);

var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
var URLUtils = require('dw/web/URLUtils');
var BasketMgr = require('dw/order/BasketMgr');
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');

server.prepend('Begin', function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }

    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var collections = require('*/cartridge/scripts/util/collections');
    var Transaction = require('dw/system/Transaction');
    var currentBasket = BasketMgr.getCurrentBasket();
    if (!currentBasket) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    if (currentBasket && currentBasket.defaultShipment.shippingMethod === null) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    SubscriptionHelper.updateCartSubscriptionDetails(currentBasket);

    // preset customer address from Klarna SignIn
    var kpCustomerAddress = session.privacy.kpCustomerAddress ? JSON.parse(session.privacy.kpCustomerAddress) : null;
    if (kpCustomerAddress && customer.externallyAuthenticated) {
        var billingAddress = currentBasket.billingAddress;
        var shipments = currentBasket.shipments;
        collections.forEach(shipments, function (shipment) {
            if (!shipment.shippingAddress) {
                COHelpers.copyCustomerAddressToShipment(kpCustomerAddress, shipment);
            }
        });

        if (!billingAddress) {
            COHelpers.copyCustomerAddressToBilling(kpCustomerAddress);
        }


        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });
    }

    // Create or update session before base call,
    // as we'll need the token & ID form basket object
    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.createOrUpdateSession();

    // Update the interoperability data in custom object if integrated via PSP
    var resultStatus = '';
    try {
        var isPSPIntegrated = JSON.parse(KlarnaHelper.getKlarnaResources().KPPreferences).isKlarnaIntegratedViaPSP;
        if (isPSPIntegrated) {
            var KlarnaInteroperabilityDataManager = require('*/cartridge/scripts/common/klarnaInteroperabilityDataManager');
            var interoperabilityData = KlarnaHelper.getInteroperabilityData(currentBasket);
            var basketId = currentBasket.UUID;
            var saved = KlarnaInteroperabilityDataManager.saveInteroperabilityData(basketId, interoperabilityData);
            if (saved) {
                log.debug('Klarna Interoperability Data saved to custom object for basketId: ' + basketId);
                resultStatus = 'DataIsSetInCustomObject';
            } else {
                log.error('Failed to save Klarna Interoperability Data to custom object');
                resultStatus = 'DataSaveFailed';
            }
        } else {
            resultStatus = 'PSPFlagDisabledAndDataNotSet';
        }
    } catch (e) {
        log.error('Error processing Klarna interoperability data: ' + e);
    }
    var viewData = res.getViewData();
    viewData.klarnaInteroperabilityDataStatus = resultStatus;
    res.setViewData(viewData);

    // If BT callback required and Finalization required, review Orders
    // If Basket empty, fail Order because user refreshed the page
    if (!currentBasket.custom.kpIsExpressCheckout) {
        var Order = require('dw/order/Order');
        var OrderMgr = require('dw/order/OrderMgr');
        var isBasketPending = session.privacy.isBasketPending;
        currentBasket = BasketMgr.getCurrentBasket();
        if (isBasketPending === 'true' && !currentBasket) {
            session.privacy.isBasketPending = null;
            try {
                var kpSessionId = session.privacy.kpSessionId;
                session.privacy.kpSessionId = null;
                var order = OrderMgr.queryOrder('custom.kpSessionId = {0} AND status = {1}', kpSessionId, Order.ORDER_STATUS_CREATED);
                // Fail Order and recreate Basket
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order, true);
                });
            } catch (e) {
                log.error('Basket cannot be recreated: ' + e);
            }
        }
    }

    return next();
});

server.append('Begin', function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }

    var currentBasket = BasketMgr.getCurrentBasket();
    var viewData = res.getViewData();

    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');

    var subscriptionData = SubscriptionHelper.getSubscriptionData(currentBasket);
    viewData.subscriptionData = subscriptionData;

    var currentCustomer = req.currentCustomer.raw;
    if (!currentCustomer.authenticated && subscriptionData) {
        session.privacy.guest_subscription_error = true;
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }
    // swik redirect
    session.custom.siwk_locale = request.locale;
    var siwkError = request.httpParameterMap.siwkError.booleanValue;
    viewData.siwkError = siwkError;

    return next();
});

module.exports = server.exports();
