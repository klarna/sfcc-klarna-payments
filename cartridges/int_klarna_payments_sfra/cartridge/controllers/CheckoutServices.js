/* globals session, empty */

'use strict';

var page = module.superModule;
var server = require('server');

server.extend(page);

server.prepend('Get', server.middleware.https, function (req, res, next) {
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
                req.currentCustomer.addressBook.preferredAddress, currentBasket);
        } else {
            // Copy over first shipping address (use shipmentUUID for matching)
            COHelpers.copyBillingAddressToBasket(
                currentBasket.defaultShipment.shippingAddress, currentBasket);
        }
    }

    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var KlarnaLocale = require('*/cartridge/scripts/klarna_payments/locale');
    var userSession = req.session.raw;

    var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());
    klarnaSessionManager.createOrUpdateSession();

    return next();
});

server.append(
    'SubmitPayment',
    function (req, res, next) {
        var Transaction = require('dw/system/Transaction');
        var BasketMgr = require('dw/order/BasketMgr');
        var KlarnaUtils = require('*/cartridge/scripts/util/klarnaUtils');
        var StringUtils = require('dw/util/StringUtils');
        var Money = require('dw/value/Money');

        var viewData = res.viewData;
        var klarnaForm = server.forms.getForm('klarna');
        var currentBasket = BasketMgr.getCurrentBasket();

        if (empty(viewData.error) && !viewData.error && viewData.paymentMethod.value === 'KLARNA_PAYMENTS') {
            var KlarnaPaymentsCategoriesModel = require('*/cartridge/scripts/klarna_payments/model/categories');
            var userSession = req.session.raw;

            var paymentCategoryID = klarnaForm.paymentCategory.value;
            var klarnaPaymentMethods = JSON.parse(userSession.privacy.KlarnaPaymentMethods);
            var kpCategories = new KlarnaPaymentsCategoriesModel(klarnaPaymentMethods);
            var selectedPaymentCategory = kpCategories.findCategoryById(paymentCategoryID);
            var paymentCategoryName = selectedPaymentCategory.name;

            this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
                var vd = res.viewData;
                var collections = require('*/cartridge/scripts/util/collections');
                var KLARNA_PAYMENT_METHOD = require('*/cartridge/scripts/util/klarnaPaymentsConstants').PAYMENT_METHOD;
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

        if (viewData.paymentMethod.value !== 'KLARNA_PAYMENTS') {
            // Cancel any previous authorizations
            var processor = require('*/cartridge/scripts/klarna_payments/processor');
            processor.cancelAuthorization();
        }

        Transaction.wrap(function () {
            currentBasket.removeAllPaymentInstruments();
        });

        return next();
    }
);

server.append('PlaceOrder', function (req, res, next) {
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

    return next();
});

module.exports = server.exports();
