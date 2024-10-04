var server = require('server');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
var hooksHelper = require('*/cartridge/scripts/helpers/hooks');
var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
var addressHelpers = require('*/cartridge/scripts/helpers/addressHelpers');
var currentSite = require('dw/system/Site').current;
var Resource = require('dw/web/Resource');
var Logger = require('dw/system/Logger');
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

/**
 * Validate basket for order
 * @param {Object} basket customer basket
 * @param {Object} req request
 * @returns result json with error status
 */
function validateCart(basket, req) {
    var validatedProducts = validationHelpers.validateProducts(basket);
    if (validatedProducts.error) {
        return {
            error: true,
            errorMessage: 'true'
        };
    }

    var validationOrderStatus = hooksHelper('app.validate.order', 'validateOrder', basket, require('*/cartridge/scripts/hooks/validateOrder').validateOrder);
    if (validationOrderStatus.error) {
        return {
            error: true,
            errorMessage: validationOrderStatus.message
        };
    }
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(basket);
    });

    var validPayment = COHelpers.validatePayment(req, basket);
    if (validPayment.error) {
        return {
            error: true,
            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
        };
    }

    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(basket);
    if (calculatedPaymentTransactionTotal.error) {
        return {
            error: true,
            errorMessage: 'Failed to calculate payment transaction.'
        };
    }

    return {
        error: false
    };
};

/**
 * Place customer order
 * @param {Object} order order to be placed
 * @param {Object} basketRef basket for order creation
 * @param {Object} req request
 * @param {Object} res response
 * @returns result json with error status
 */
function placeOrder(order, basketRef, req, res) {
    // Handles payment authorization
    var handlePaymentResult = COHelpers.handlePayments(order, order.orderNo, true);

    // Handle custom processing post authorization
    var options = {
        req: req,
        res: res
    };
    var postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, order, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
    if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
        return postAuthCustomizations;
    }

    if (handlePaymentResult.error) {
        return handlePaymentResult;
    }

    var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', basketRef, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
    if (fraudDetectionStatus.status === 'fail') {
        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });

        // fraud detection failed
        req.session.privacyCache.set('fraudDetectionStatus', true);

        return {
            error: true,
            errorMessage: 'Fraud detection error.'
        };
    }

    // Places the order
    var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus);
    if (placeOrderResult.error) {
        return {
            error: true,
            errorMessage: 'Failed to place order.'
        };
    }

    if (order.getCustomerEmail()) {
        COHelpers.sendConfirmationEmail(order, request.locale);
    }
    return {
        error: false,
        order: order
    };
}

/**
 * Create order from order reference
 * @param {Object} orderRef order to use for reference
 * @returns 
 */
function createOrder(orderRef, req, res) {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var copyOrderToBasket = require('*/cartridge/scripts/subscription/copyOrderToBasket').copyOrderToBasket;
    var BasketMgr = require('dw/order/BasketMgr');
    var Basket = require('dw/order/Basket');
    var placeOrderResult = {};

    Transaction.begin();
    try {
        var loginResult = SubscriptionHelper.loginOnBehalfOfCustomer(orderRef);
        if (loginResult.error) {
            throw new Error(loginResult.message);
        }

        KlarnaHelper.isCurrentCountryKlarnaEnabled();
        var customerBasket = copyOrderToBasket(orderRef, req);
        var valResult = validateCart(customerBasket, req);

        if (valResult.error) {
            throw new Error(valResult.errorMessage ? valResult.errorMessage : 'Error in cart validation!');
        }

        if (customerBasket.productLineItems.size() === 0) {
            throw new Error('No items available for subscription!');
        }

        customerBasket.setChannelType(Basket.CHANNEL_TYPE_SUBSCRIPTIONS);

        // Creates a new order.
        var order = COHelpers.createOrder(customerBasket);
        if (!order) {
            throw new Error('Failed to create order from basket.');
        }

        order.custom.kpCustomerToken = orderRef.custom.kpCustomerToken;
        order.addNote('Subscription', 'Previous order no ' + orderRef.orderNo);

        placeOrderResult = placeOrder(order, customerBasket, req, res);

        if (placeOrderResult.error) {
            throw new Error(placeOrderResult.errorMessage);
        }

        Transaction.commit();
    } catch (e) {
        Transaction.rollback();

        res.json({
            error: true,
            errorMessage: e.message
        });
        Logger.error(e.stack);
        return;
    }

    res.json({
        error: false,
        orderID: order.orderNo,
        subscriptionProducts: SubscriptionHelper.getSubscriptionProducts(order)
    });
}

/**
 * Create recurring order for Klarna subscriptions
 * @returns {Object} result json with error status
 */
server.post('Create', function (req, res, next) {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var BasketMgr = require('dw/order/BasketMgr');
    var Basket = require('dw/order/Basket');

    var validationResult = SubscriptionHelper.validateIncomingParams(req.body, req);
    if (validationResult.error) {
        res.json(validationResult);
        return next();
    }
    var orderRef = validationResult.orderRef;

    createOrder(orderRef, req, res);

    return next();
});

/**
 * Pay order when trial period is over
 * @returns {Object} result json with error status
 */
server.post('PayOrder', function (req, res, next) {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    KlarnaHelper.isCurrentCountryKlarnaEnabled();

    var validationResult = SubscriptionHelper.validateIncomingParams(req.body, req);
    if (validationResult.error) {
        res.json(validationResult);
        return next();
    }
    var orderRef = validationResult.orderRef;

    var orderItemsValidation = SubscriptionHelper.validateCart(orderRef);

    if (orderItemsValidation.allNotAvailable) {
        res.json({
            error: true,
            errorMessage: "All order items are not available - " + orderNo
        });
        return next();
    } else if (orderItemsValidation.allAvailable) {
        Transaction.begin();
        try {
            // Handles payment authorization
            var handlePaymentResult = COHelpers.handlePayments(orderRef, orderRef.orderNo, true);

            // Handle custom processing post authorization
            var options = {
                req: req,
                res: res
            };
            var postAuthCustomizations = hooksHelper('app.post.auth', 'postAuthorization', handlePaymentResult, orderRef, options, require('*/cartridge/scripts/hooks/postAuthorizationHandling').postAuthorization);
            if (postAuthCustomizations && Object.prototype.hasOwnProperty.call(postAuthCustomizations, 'error')) {
                res.json(postAuthCustomizations);
                return next();
            }

            if (handlePaymentResult.error) {
                res.json({
                    error: true,
                    errorMessage: Resource.msg('error.technical', 'checkout', null)
                });
                return next();
            }

            var fraudDetectionStatus = hooksHelper('app.fraud.detection', 'fraudDetection', orderRef, require('*/cartridge/scripts/hooks/fraudDetection').fraudDetection);
            if (fraudDetectionStatus.status === 'fail') {
                Transaction.wrap(function () { OrderMgr.failOrder(orderRef, true); });

                // fraud detection failed
                req.session.privacyCache.set('fraudDetectionStatus', true);

                res.json({
                    error: true,
                    cartError: true,
                    redirectUrl: URLUtils.url('Error-ErrorCode', 'err', fraudDetectionStatus.errorCode).toString(),
                    errorMessage: Resource.msg('error.technical', 'checkout', null)
                });

                return next();
            }

            if (orderRef.getCustomerEmail()) {
                COHelpers.sendConfirmationEmail(orderRef, request.locale);
            }

            Transaction.commit();
        } catch (e) {
            var ex = e;
            Transaction.rollback();
            res.json({
                error: true,
                errorMessage: e.message
            });
            Logger.error(e.stack);
            return next();
        }

        res.json({
            error: false,
            orderID: orderRef.orderNo
        });
    } else {
        createOrder(orderRef, req, res);
    }
    return next();

});

module.exports = server.exports();