/* globals empty, session, request */

'use strict';

var server = require('server');

var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');

server.post('Notification', function (req, res) {
    var OrderMgr = require('dw/order/OrderMgr');
    var processor = require('*/cartridge/scripts/payments/processor');
    var FRAUD_STATUS_MAP = require('*/cartridge/scripts/util/klarnaPaymentsConstants').FRAUD_STATUS_MAP;

    var requestParams = req.form;

    var klarnaPaymentsFraudDecisionObject = JSON.parse(req.body);

    var klarna_oms__kpOrderID = klarnaPaymentsFraudDecisionObject.order_id;
    var kpEventType = klarnaPaymentsFraudDecisionObject.event_type;
    var currentCountry = requestParams.klarna_country;

    res.setStatusCode(200);

    try {
        var klarnaOrder = processor.getKlarnaOrder(klarna_oms__kpOrderID);
        if (klarnaOrder && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] === kpEventType) {
            var order = OrderMgr.queryOrder('custom.klarna_oms__kpOrderID = {0}', klarna_oms__kpOrderID);
            if (order) {
                processor.notify(order, klarna_oms__kpOrderID, kpEventType, currentCountry);
            }
        }
    } catch (e) {
        log.error(e);
    }
});

server.get('SaveAuth', function (req, res) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    // var processor = require('*/cartridge/scripts/payments/processor');

    var token = req.httpHeaders['x-auth'];
    var finalizeRequired = req.httpHeaders['finalize-required'];

    // Cancel any previous authorizations
    // processor.cancelAuthorization();

    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.saveAuthorizationToken(token, finalizeRequired);

    res.setStatusCode(200);
});

server.get('LoadAuth', function (req, res) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');

    var klarnaSessionManager = new KlarnaSessionManager();
    var authInfo = klarnaSessionManager.loadAuthorizationInfo();

    res.json(authInfo);

    res.setStatusCode(200);

    this.emit('route:Complete', req, res);
});

server.get('RefreshSession', function (req, res) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');

    var klarnaSessionManager = new KlarnaSessionManager();
    var response = klarnaSessionManager.createOrUpdateSession();

    res.json({
        klarna: response,
        paymentMethodHtmlName: server.forms.getForm('billing').paymentMethod.htmlName,
        paymentCategoryHtmlName: server.forms.getForm('klarna').paymentCategory.htmlName
    });

    res.setStatusCode(200);

    this.emit('route:Complete', req, res);
});

server.get('InfoPage', function (req, res, next) {
    res.render('klarnapayments/infoPage');
    next();
});

server.post('SelectPaymentMethod', function (req, res, next) {
    var PaymentManager = require('dw/order/PaymentMgr');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();

    var paymentForm = server.forms.getForm('billing');
    var paymentMethodIdValue = paymentForm.paymentMethod.value;

    if (!paymentMethodIdValue || !PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
        res.json({
            error: true
        });
    }

    var viewData = {
        paymentMethod: {
            value: paymentMethodIdValue,
            htmlName: paymentMethodIdValue
        }
    };

    res.setViewData(viewData);

    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var BasketMgr = require('dw/order/BasketMgr');
        var HookMgr = require('dw/system/HookMgr');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var Transaction = require('dw/system/Transaction');
        var AccountModel = require('*/cartridge/models/account');
        var OrderModel = require('*/cartridge/models/order');
        var Locale = require('dw/util/Locale');
        var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
        var URLUtils = require('dw/web/URLUtils');
        var currentBasket = BasketMgr.getCurrentBasket();
        var billingData = res.getViewData();
        var paymentMethodID = billingData.paymentMethod.value;
        var result;

        // if we have no basket or there is no selected payment option and balance is greater than zero
        if (!currentBasket || (!paymentMethodID && currentBasket.totalGrossPrice.value > 0)) {
            res.json({
                error: true
            });
            return;
        }

        var paymentInstruments = currentBasket.getPaymentInstruments(PAYMENT_METHOD);

        // if the selected payment matches Klarna
        if (paymentMethodID === PAYMENT_METHOD) {
            if (paymentInstruments.length === 0) {
                var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();
                if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
                    result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
                        'Handle',
                        currentBasket,
                        billingData.paymentInformation,
                        paymentMethodID,
                        req
                    );
                } else {
                    result = HookMgr.callHook('app.payment.processor.default', 'Handle');
                }

                if (result.error) {
                    res.json({
                        error: true
                    });
                    return;
                }
            }
        } else {
            // To handle Credit Cards we need to receive the card details, which are unavailable with just clicking on tabs.
            // In this case we will remove the Klarna payment instrument in order to remove any specific payment promotions
            // Update this logic here if necessary
            var collections = require('*/cartridge/scripts/util/collections');

            Transaction.wrap(function () {
                var paymentInstruments = currentBasket.getPaymentInstruments(PAYMENT_METHOD);
                collections.forEach(paymentInstruments, function (item) {
                    currentBasket.removePaymentInstrument(item);
                });
            });
        }

        var currentBasketTotal = currentBasket.totalGrossPrice.value;

        // Calculate the basket
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(currentBasket);
        });

        // Re-calculate the payments.
        var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(currentBasket);
        if (calculatedPaymentTransaction.error) {
            res.json({
                error: true
            });
            return;
        }

        var newBasketTotal = currentBasket.totalGrossPrice.value;

        if (!currentBasket.customerEmail || currentBasket.defaultShipment.shippingMethod === null) {
            res.json({
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()

            });
            return;
        }

        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
            req.session.privacyCache.set('usingMultiShipping', false);
            usingMultiShipping = false;
        }

        var accountModel = new AccountModel(req.currentCustomer);

        if (paymentMethodID === PAYMENT_METHOD) {
            // Update Klarna session details if we have selected Klarna option,
            // before placing order in order to get the correct order number
            // including taxation and discount.
            // We don't want to update the session if we are going to continue with non-Klarna payment
            // as cancellation will be issued later
            var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');

            var klarnaSessionManager = new KlarnaSessionManager();
            klarnaSessionManager.createOrUpdateSession();
        }
        var currentLocale = Locale.getLocale(req.locale.id);
        var basketModel = new OrderModel(currentBasket, {
            usingMultiShipping: usingMultiShipping,
            countryCode: currentLocale.country,
            containerView: 'basket'
        });
        res.json({
            order: basketModel,
            customer: accountModel,
            updateSummary: currentBasketTotal !== newBasketTotal,
            error: false
        });
    });

    next();
});

server.post('ExpressCheckout', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var HookMgr = require('dw/system/HookMgr');
    var PaymentMgr = require('dw/order/PaymentMgr');

    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var collections = require('*/cartridge/scripts/util/collections');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');
    var KlarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');

    var EXPRESS_CATEGORY = KlarnaOSM.getExpressButtonCategory();
    var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;

    var currentBasket = BasketMgr.getCurrentBasket();
    var expressForm = server.forms.getForm('klarnaexpresscheckout');
    var klarnaDetails = KlarnaHelper.getExpressFormDetails(expressForm);

    if (!currentBasket) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    // Get current shipments
    var shipments = currentBasket.shipments;

    // Pre-populate shipping details
    var hasShippingMethod = true;
    collections.forEach(shipments, function (shipment) {
        // Pre-populate address details if not already present
        // Don't update it on store pickup shipments as this is the store address
        if ((!shipment.shippingAddress || !shipment.shippingAddress.address1) && empty(shipment.custom.fromStoreId)) {
            COHelpers.copyCustomerAddressToShipment(klarnaDetails, shipment);
        }

        // Pre-select the shipping method if it's not already set (i.e. on basket page)
        // Selects the first one in the list for the respective address
        var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods(shipment, shipment.shippingAddress);
        var hasShippingMethodSet = !!shipment.shippingMethod;

        // Check if the selected on Cart Page method is still applicable
        if (hasShippingMethodSet) {
            hasShippingMethodSet = collections.find(applicableShippingMethods, function (item) {
                return item.ID === shipment.shippingMethodID;
            });
        }

        // If we have no shipping method or it's no longer applicable - try to select the first one
        if (!hasShippingMethodSet) {
            var shippingMethod = collections.first(applicableShippingMethods);
            if (shippingMethod) {
                Transaction.wrap(function () {
                    ShippingHelper.selectShippingMethod(shipment, shippingMethod.ID);
                });
            } else {
                hasShippingMethod = false;
            }
        }
    });

    // Always pre-populate billing address & email
    KlarnaHelper.setExpressBilling(currentBasket, klarnaDetails);

    // Calculate the basket & shipments
    Transaction.wrap(function () {
        COHelpers.ensureNoEmptyShipments(req);
    });

    // Handle the selection of this payment method - calculate if any payment promotions are available
    var result;
    var processor = PaymentMgr.getPaymentMethod(PAYMENT_METHOD).getPaymentProcessor();
    if (HookMgr.hasHook('app.payment.processor.' + processor.ID.toLowerCase())) {
        result = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(),
            'Handle',
            currentBasket,
            null,
            PAYMENT_METHOD,
            req
        );
    } else {
        result = HookMgr.callHook('app.payment.processor.default', 'Handle');
    }

    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    if (result.error) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    var stage = 'payment';
    if (!hasShippingMethod) {
        // Redirect to shipping section if we don't have all shipping methods
        stage = 'shipping';
    }

    session.privacy.KlarnaExpressCategory = EXPRESS_CATEGORY;

    res.redirect(URLUtils.url('Checkout-Begin', 'stage', stage));
    return next();
});

server.post('WriteLog', function (req, res, next) {
    var KlarnaAdditionalLogging = require('*/cartridge/scripts/util/klarnaAdditionalLogging');
    var BasketMgr = require('dw/order/BasketMgr');
    var basket = BasketMgr.getCurrentBasket();
    var storeFrontResponse = JSON.stringify(req.form);

    KlarnaAdditionalLogging.writeLog(basket, basket.custom.kpSessionId, req.form.actionName, req.form.message + ' Response Object:' + storeFrontResponse);

    return next();
});

module.exports = server.exports();
