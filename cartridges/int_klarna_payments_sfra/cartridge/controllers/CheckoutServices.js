/* globals session, empty */
/* eslint-disable sitegenesis/no-global-require */

'use strict';

var page = module.superModule;
var server = require('server');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

server.extend(page);

server.prepend('Get', server.middleware.https, function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }

    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var URLUtils = require('dw/web/URLUtils');

    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    if (!currentBasket.billingAddress || !currentBasket.billingAddress.address1) {
        if (req.currentCustomer.addressBook
            && req.currentCustomer.addressBook.preferredAddress) {
            // Copy over preferredAddress (use addressUUID for matching)
            COHelpers.copyBillingAddressToBasket(
                req.currentCustomer.addressBook.preferredAddress, currentBasket
            );
        } else {
            // Copy over first shipping address (use shipmentUUID for matching)
            COHelpers.copyBillingAddressToBasket(
                currentBasket.defaultShipment.shippingAddress, currentBasket
            );
        }
    }

    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');

    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.createOrUpdateSession();

    return next();
});

server.append(
    'SubmitPayment',
    function (req, res, next) {
        var Transaction = require('dw/system/Transaction');
        var BasketMgr = require('dw/order/BasketMgr');
        var KlarnaUtils = require('*/cartridge/scripts/util/klarnaHelper');
        var StringUtils = require('dw/util/StringUtils');
        var URLUtils = require('dw/web/URLUtils');
        var Money = require('dw/value/Money');
        if (!KlarnaUtils.isCurrentCountryKlarnaEnabled()) {
            return next();
        }

        var viewData = res.viewData;
        var klarnaForm = server.forms.getForm('klarna');
        var currentBasket = BasketMgr.getCurrentBasket();
        var KLARNA_PAYMENT_DEFAULT = require('*/cartridge/scripts/util/klarnaPaymentsConstants').PAYMENT_METHOD;

        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        if (empty(viewData.error) && !viewData.error && viewData.paymentMethod.value.indexOf(KLARNA_PAYMENT_DEFAULT) >= 0) {
            var KlarnaPaymentsCategoriesModel = require('*/cartridge/scripts/payments/model/categories');
            var userSession = req.session.raw;

            var paymentCategoryID = klarnaForm.paymentCategory.value;
            var klarnaPaymentMethods = JSON.parse(userSession.privacy.KlarnaPaymentMethods);
            var kpCategories = new KlarnaPaymentsCategoriesModel(klarnaPaymentMethods);
            var selectedPaymentCategory = kpCategories.findCategoryById(paymentCategoryID);
            var paymentCategoryName = selectedPaymentCategory.name;

            this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
                var vd = res.viewData;
                var collections = require('*/cartridge/scripts/util/collections');
                var KLARNA_PAYMENT_METHOD = KlarnaUtils.getPaymentMethod();
                var paymentInstrument = collections.find(currentBasket.getPaymentInstruments(), function (item) {
                    return item.paymentMethod === KLARNA_PAYMENT_METHOD;
                });

                Transaction.wrap(function () {
                    paymentInstrument.custom.klarnaPaymentCategoryID = paymentCategoryID;
                    paymentInstrument.custom.klarnaPaymentCategoryName = paymentCategoryName;
                });

                Transaction.wrap(function () {
                    vd.order.billing.payment.selectedPaymentInstruments[0].amountFormatted = StringUtils.formatMoney(new Money(vd.order.billing.payment.selectedPaymentInstruments[0].amount, currentBasket.getCurrencyCode()));
                    vd.order.billing.payment.selectedPaymentInstruments[0].name = KlarnaUtils.getKlarnaPaymentMethodName();
                    vd.order.billing.payment.selectedPaymentInstruments[0].categoryName = paymentCategoryName;
                });
            });
        }

        if (empty(viewData.error) && !viewData.error && viewData.paymentMethod.value.indexOf(KLARNA_PAYMENT_DEFAULT) === -1) {
            // Cancel any previous authorizations
            var processor = require('*/cartridge/scripts/payments/processor');
            processor.cancelAuthorization();
        }

        Transaction.wrap(function () {
            currentBasket.removeAllPaymentInstruments();
        });

        return next();
    }
);

server.prepend('PlaceOrder', function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }

    // Store Klarna SessionID to the user's session on PlaceOrder
    try {
        var BasketMgr = require('dw/order/BasketMgr');
        var basket = BasketMgr.getCurrentBasket();
        var kpSessionId = basket.custom.kpSessionId;
        session.privacy.kpSessionId = kpSessionId;
    } catch (e) {
        var Logger = require('dw/system/Logger');
        var log = Logger.getLogger('KlarnaPayments');
        log.error('Cannot read Klarna SessionID: ' + e);
    }

    return next();
});

server.append('PlaceOrder', function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }
    var URLUtils = require('dw/web/URLUtils');
    var KLARNA_PAYMENT_URLS = require('*/cartridge/scripts/util/klarnaPaymentsConstants').KLARNA_PAYMENT_URLS;

    // remove kpClientToken from order
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(res.viewData.orderID);

    if (order && !empty(order.custom.kpClientToken)) {
        var Transaction = require('dw/system/Transaction');
        Transaction.wrap(function () {
            order.custom.kpClientToken = null;
        });
    }

    // set KlarnaPayments-ShowConfirmation endpoint as the continue url to display order confirmation page
    res.setViewData({
        continueUrl: URLUtils.url(KLARNA_PAYMENT_URLS.CONFIRMATION).toString()
    });

    var redirectURL = req.session.privacyCache.get('KlarnaPaymentsRedirectURL');

    if (redirectURL) {
        req.session.privacyCache.set('KlarnaPaymentsRedirectURL', null);

        if (!res.viewData.error) {
            res.setViewData({
                orderID: null,
                orderToken: null,
                error: false,
                continueUrl: redirectURL
            });
        }
    }

    // clear KEB method
    req.session.privacyCache.set('KlarnaExpressCategory', null);

    return next();
});

module.exports = server.exports();
