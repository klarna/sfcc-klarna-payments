'use strict';

var server = require('server');

/**
 * Create Recurring payment in klarna
 * This function can be extended for customization based on the merchant's requirements
 */
server.post('CreateRecurringPayment', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var createOrderHelper = require('*/cartridge/scripts/order/klarnaPaymentsCreateRecurringOrder');
    var klarnaSessionManager = new KlarnaSessionManager();

    var customerToken = req.form.subscriptionToken;
    var payload = req.form.subscriptionPayload;

    if (!customerToken) {
        res.json({
            success: false,
            message: Resource.msg('invalid.subscription.token.msg', 'subscription', null)
        });
        return next();
    }

    if (!payload) {
        res.json({
            success: false,
            message: Resource.msg('invalid.payload.msg', 'subscription', null)
        });
        return next();
    }

    // Get locale and create the Klarna recurring order
    var localeObject = klarnaSessionManager.getLocale();
    var klarnaCreateOrderResponse = createOrderHelper.createOrderForSubscriptions(payload, localeObject, customerToken);

    if (klarnaCreateOrderResponse.success) {
        res.json({
            success: true,
            message: Resource.msg('recurring.order.created', 'subscription', null)
        });
    } else {
        res.json({
            success: false,
            message: klarnaCreateOrderResponse.errorMessage
        });
    }

    return next();
});

module.exports = server.exports();
