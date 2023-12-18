/* globals session */
var page = module.superModule; // inherits functionality
var server = require('server');

server.extend(page);

var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
var URLUtils = require('dw/web/URLUtils');
var BasketMgr = require('dw/order/BasketMgr');

server.prepend('Begin', function (req, res, next) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket && currentBasket.defaultShipment.shippingMethod === null) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    SubscriptionHelper.updateCartSubscriptionDetails(currentBasket);

    // Create or update session before base call,
    // as we'll need the token & ID form basket object
    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.createOrUpdateSession();

    // If BT callback required and Finalization required, review Orders
    // If Basket empty, fail Order because user refreshed the page
    var Site = require('dw/system/Site');
    var kpBankTransferCallback = Site.getCurrent().getCustomPreferenceValue('kpBankTransferCallback');
    if (kpBankTransferCallback) {
        var Logger = require('dw/system/Logger');
        var log = Logger.getLogger('KlarnaPayments');
        var Order = require('dw/order/Order');
        var OrderMgr = require('dw/order/OrderMgr');
        var Transaction = require('dw/system/Transaction');

        var isBasketPending = session.privacy.isBasketPending;
        var currentBasket = BasketMgr.getCurrentBasket();
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

    return next();
});

module.exports = server.exports();
