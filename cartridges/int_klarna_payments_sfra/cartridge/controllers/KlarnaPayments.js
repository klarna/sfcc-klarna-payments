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

    var kpOrderID = klarnaPaymentsFraudDecisionObject.order_id;
    var kpEventType = klarnaPaymentsFraudDecisionObject.event_type;
    var currentCountry = requestParams.klarna_country;

    res.setStatusCode(200);

    try {
        var klarnaOrder = processor.getKlarnaOrder(kpOrderID);
        if (klarnaOrder && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] === kpEventType) {
            var order = OrderMgr.queryOrder('custom.kpOrderID = {0}', kpOrderID);
            if (order) {
                processor.notify(order, kpOrderID, kpEventType, currentCountry);
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
    var KlarnaPaymentsConstants = require('*/cartridge/scripts/util/klarnaPaymentsConstants');

    var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;
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

        // if the selected payment matches Klarna
        if (paymentMethodID === PAYMENT_METHOD) {
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

        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
            req.session.privacyCache.set('usingMultiShipping', false);
            usingMultiShipping = false;
        }

        var currentLocale = Locale.getLocale(req.locale.id);
        var basketModel = new OrderModel(currentBasket, {
            usingMultiShipping: usingMultiShipping,
            countryCode: currentLocale.country,
            containerView: 'basket'
        });

        var accountModel = new AccountModel(req.currentCustomer);

        if (currentBasketTotal !== newBasketTotal && paymentMethodID === PAYMENT_METHOD) {
            // update Klarna session details only if we have different new totals, i.e. promotions applied
            // and if we have selected Klarna option.
            // We don't want to update the session if we are going to continue with non-Klarna payment
            // as cancellation will be issued later
            var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');

            var klarnaSessionManager = new KlarnaSessionManager();
            klarnaSessionManager.createOrUpdateSession();
        }

        res.json({
            order: basketModel,
            customer: accountModel,
            updateSummary: currentBasketTotal !== newBasketTotal,
            error: false
        });
    });

    next();
});

module.exports = server.exports();
