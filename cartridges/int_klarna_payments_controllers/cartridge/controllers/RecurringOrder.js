'use strict';

/**
 * Controller for all Recurring Order related functions.
 *
 * @module controllers/RecurringOrder
 */

/* API Includes */
var PaymentMgr = require('dw/order/PaymentMgr');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var BasketMgr = require('dw/order/BasketMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Status = require('dw/system/Status');

/* Script Modules */
var guard = require('*/cartridge/scripts/guard');
var app = require('*/cartridge/scripts/app');

var Cart = app.getModel('Cart');
var Order = app.getModel('Order');
var PaymentProcessor = app.getModel('PaymentProcessor');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

/**
 * Handle payments for order
 * @param {Object} order order
 * @returns {Object} result json with error status
 */
function handlePayments(order) {

    if (order.getTotalNetPrice().value !== 0.00) {

        var paymentInstruments = order.getPaymentInstruments();

        if (paymentInstruments.length === 0) {
            return {
                missingPaymentInfo: true,
                error: true
            };
        }
        /**
         * Sets the transaction ID for the payment instrument.
         */
        var handlePaymentTransaction = function () {
            paymentInstrument.getPaymentTransaction().setTransactionID(order.getOrderNo());
        };

        for (var i = 0; i < paymentInstruments.length; i++) {
            var paymentInstrument = paymentInstruments[i];

            if (PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor() === null) {

                Transaction.wrap(handlePaymentTransaction);

            } else {

                var authorizationResult = PaymentProcessor.authorize(order, paymentInstrument, true);

                if (authorizationResult.not_supported || authorizationResult.error) {
                    return {
                        error: true
                    };
                }
            }
        }
    }

    return { error: false };
}

/**
 * Execute steps to place order
 * @param {Object} basket customer basket
 * @param {Object} orderRef order reference
 * @returns {Object} result json with error status 
 */
function placeOrder(basket, orderRef) {
    var cart = Cart.get(basket);

    if (!cart) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, "Couldn't build cart model.")
        };
    }

    Transaction.wrap(function () {
        cart.calculate();
    });

    var validateCartResult = cart.validateForCheckout();

    if (validateCartResult === 2 || validateCartResult.BasketStatus.error) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, 'Cart validation failed.')
        };
    }

    var COShipping = app.getController('COShipping');

    // Clean shipments.
    COShipping.PrepareShipments(basket);

    // Make sure there is a valid shipping address, accounting for gift certificates that do not have one.
    if (cart.getProductLineItems().size() > 0 && cart.getDefaultShipment().getShippingAddress() === null) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, 'Missing shipping address.')
        };
    }

    Transaction.wrap(function () {
        cart.calculate();
    });

    var COBilling = app.getController('COBilling');

    Transaction.wrap(function () {
        if (!COBilling.ValidatePayment(cart)) {
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'Payment validation failed.')
            };
        }
    });

    // Recalculate the payments. If there is only gift certificates, make sure it covers the order total, if not
    // back to billing page.
    Transaction.wrap(function () {
        if (!cart.calculatePaymentTransactionTotal()) {
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'Calculate payment transactional failed.')
            };
        }
    });

    // Handle used addresses and credit cards.
    var saveCCResult = COBilling.SaveCreditCard();

    if (!saveCCResult) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, 'Save CC failed.')
        };
    }

    // Creates a new order. This will internally ReserveInventoryForOrder and will create a new Order with status
    // 'Created'.
    var order = cart.createOrder(basket);

    if (!order) {
        return {
            error: true,
            PlaceOrderError: new Status(Status.ERROR, 'Order not created.')
        };
    }
    Transaction.wrap(function () {
        order.custom.kpCustomerToken = orderRef.custom.kpCustomerToken;
    });

    var handlePaymentsResult = handlePayments(order);

    if (handlePaymentsResult.error) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'Failed to handle payments.')
            };
        });

    } else if (handlePaymentsResult.missingPaymentInfo) {
        return Transaction.wrap(function () {
            OrderMgr.failOrder(order);
            return {
                error: true,
                PlaceOrderError: new Status(Status.ERROR, 'Missing payment info.')
            };
        });
    }

    var orderPlacementStatus = Order.submit(order);
    return orderPlacementStatus;
}

function createOrder(orderRef) {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var copyOrderToBasket = require('*/cartridge/scripts/subscription/copyOrderToBasket').copyOrderToBasketSG;
    var Basket = require('dw/order/Basket');
    let r = require('*/cartridge/scripts/util/Response');
    Transaction.begin();
    try {
        var loginResult = SubscriptionHelper.loginOnBehalfOfCustomer(orderRef);
        if (loginResult.error) {
            throw new Error(loginResult.message);
        }

        KlarnaHelper.isCurrentCountryKlarnaEnabled();

        var customerBasket = copyOrderToBasket(orderRef, request);
        customerBasket.setChannelType(Basket.CHANNEL_TYPE_SUBSCRIPTIONS);

        if (!customerBasket || customerBasket.productLineItems.size() === 0) {
            r.renderJSON({
                error: true,
                errorMessage: 'No items available for subscription!'
            });
            return;
        }

        var placeOrderResult = placeOrder(customerBasket, orderRef);
        if (placeOrderResult.error) {
            throw new Error(placeOrderResult.PlaceOrderError.message);
        } else if (placeOrderResult.order_created) {
            Transaction.wrap(function () {
                session.privacy.KlarnaPaymentMethods = null;
                session.privacy.SelectedKlarnaPaymentMethod = null;
                session.privacy.KlarnaExpressCategory = null;
            });
        }

        placeOrderResult.Order.addNote('Subscription', 'Previous order no ' + orderRef.orderNo);

        Transaction.commit();
    } catch (e) {
        Transaction.rollback();

        Logger.error(e);
        Logger.error(e.stack);
        r.renderJSON({
            error: true,
            errorMessage: e.message
        });
        return;
    }

    r.renderJSON({
        error: false,
        orderID: placeOrderResult.Order.orderNo,
        subscriptionProducts: SubscriptionHelper.getSubscriptionProducts(placeOrderResult.Order)
    });
}

/**
 * Create recurring order for Klarna subscriptions
 * @returns {Object} result json with error status
 */
function create() {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    let r = require('*/cartridge/scripts/util/Response');

    var validationResult = SubscriptionHelper.validateIncomingParams(request.httpParameterMap.requestBodyAsString, request);
    if (validationResult.error) {
        r.renderJSON(validationResult);
        return;
    }

    var orderRef = validationResult.orderRef;

    createOrder(orderRef);

    return;
}

/**
 * Pay order when trial period is over
 * @returns {Object} result json with error status
 */
function payOrder() {
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    let r = require('*/cartridge/scripts/util/Response');
    KlarnaHelper.isCurrentCountryKlarnaEnabled();

    var validationResult = SubscriptionHelper.validateIncomingParams(request.httpParameterMap.requestBodyAsString, request);
    if (validationResult.error) {
        r.renderJSON(validationResult);
        return;
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
            var handlePaymentsResult = handlePayments(orderRef);

            if (handlePaymentsResult.error || handlePaymentsResult.missingPaymentInfo) {
                throw new Error(new Status(Status.ERROR, 'confirm.error.technical'));
            }
            Transaction.commit();
        } catch (e) {
            Transaction.rollback();
            r.renderJSON({
                error: true,
                errorMessage: e.message
            });
            return;
        }

        r.renderJSON({
            error: false,
            orderID: orderRef.orderNo
        });
    } else {
        createOrder(orderRef);
    }

    return;
}

/** Creates recurring order for subscriptions
 * @see {@link module:controllers/RecurringOrder~create} */
exports.Create = guard.ensure(['post', 'https'], create);
/** Pay trial subscription order
 * @see {@link module:controllers/RecurringOrder~payOrder} */
exports.PayOrder = guard.ensure(['post', 'https'], payOrder);