'use strict';

/**
 * @namespace Cart
 */

var page = module.superModule; // inherits functionality
var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.extend(page);

/**
 * Cart-UpdateSubscription : The Cart-UpdateSubscription endpoint handles updating the subscription status of a product line item in the basket
 * @name Cart-UpdateSubscription
 * @function
 * @memberof Cart
 * @param {querystringparameter} - pid - the product id
 * @param {querystringparameter} - subscription - the subscription status to be updated for the line item
 * @param {querystringparameter} -  uuid - the universally unique identifier of the product object
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get('UpdateSubscription', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var CartModel = require('*/cartridge/models/cart');
    var collections = require('*/cartridge/scripts/util/collections');
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.setStatusCode(500);
        res.json({
            error: true,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });

        return next();
    }

    var productId = req.querystring.pid;
    var subscription = req.querystring.subscription === 'true';
    var uuid = req.querystring.uuid;
    var productLineItems = currentBasket.productLineItems;
    var matchingLineItem = collections.find(productLineItems, function (item) {
        return item.productID === productId && item.UUID === uuid;
    });

    if (matchingLineItem) {
        Transaction.wrap(function () {
            matchingLineItem.custom.kpSubscription = subscription;
        });
    }

    if (matchingLineItem) {
        var isSubscriptionBasket = SubscriptionHelper.isSubscriptionBasket(currentBasket);
        var basketModel = new CartModel(currentBasket);
        res.json({
            basket: basketModel,
            isSubscriptionBasket: isSubscriptionBasket
        });
    } else {
        res.setStatusCode(500);
        res.json({
            errorMessage: Resource.msg('error.cannot.update.product.subscription', 'subscription', null)
        });
    }

    return next();
});

server.append('Show', server.middleware.https, consentTracking.consent, csrfProtection.generateToken, function (req, res, next) {
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }
    var Resource = require('dw/web/Resource');
    var BasketMgr = require('dw/order/BasketMgr');
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

    var viewData = res.getViewData();

    var subscriptionUserError = session.privacy.guest_subscription_error;
    session.privacy.guest_subscription_error = null;
    if (subscriptionUserError) {
        var result = {
            error: true,
            message: Resource.msg('klarna.subscription.checkout.guestuser.error', 'subscription', null)
        };
        viewData.valid = result;
    }

    var currentBasket = BasketMgr.getCurrentBasket();
    if (currentBasket) {
        var subscriptionData = SubscriptionHelper.getSubscriptionDataCart(currentBasket);
        var isSubscriptionBasket = SubscriptionHelper.isSubscriptionBasket(currentBasket);
        viewData.subscriptionData = subscriptionData;
        viewData.isSubscriptionBasket = isSubscriptionBasket;
    }

    return next();
});

/**
 * Cart-UpdateSubscriptionPeriod : The Cart-UpdateSubscriptionPeriod endpoint handles updating the subscription 
 * period in the basket
 * @name Cart-UpdateSubscriptionPeriod
 * @function
 * @memberof Cart
 * @param {querystringparameter} - subscription period - the subscription period to be updated for basket
 * @param {returns} - json
 * @param {serverfunction} - get
 */
server.get('UpdateSubscriptionDetails', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var URLUtils = require('dw/web/URLUtils');
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.setStatusCode(500);
        res.json({
            error: true,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });

        return next();
    }

    var selectedValue = req.querystring.selectedValue;
    var subscriptionField = req.querystring.subscriptionField
    var updated = SubscriptionHelper.updateSubscriptionAttribute(currentBasket, subscriptionField, selectedValue);

    if (updated) {
        res.json({
            error: false
        });
    }
    else {
        res.json({
            error: true,
            errorMessage: subscriptionField + ' value - ' + selectedValue + ' not found in' + subscriptionField + ' configurarion.'
        });
    }

    return next();
});

module.exports = server.exports();