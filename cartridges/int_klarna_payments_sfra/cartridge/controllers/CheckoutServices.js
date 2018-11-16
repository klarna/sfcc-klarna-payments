'use strict';

var page = module.superModule;
var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

var KLARNA_PAYMENT_METHOD = require('~/cartridge/scripts/util/KlarnaPaymentsConstants').PAYMENT_METHOD;

server.extend(page);

/**
 * Calculates the amount to be payed by a non-gift certificate payment instrument based
 * on the given basket. The method subtracts the amount of all redeemed gift certificates
 * from the order total and returns this value.
 *
 * @param {Object} lineItemCtnr - LineIteam Container (Basket or Order)
 * @returns {dw.value.Money} non gift certificate amount
 */
function calculateNonGiftCertificateAmount(lineItemCtnr) {
    var orderTotal = 0;

    orderTotal = lineItemCtnr.totalGrossPrice;

    return orderTotal;
}

function validatePaymentAmount(currentBasket) {
    var PaymentMgr = require('dw/order/PaymentMgr');

    var amount = calculateNonGiftCertificateAmount(currentBasket);
    var paymentInstruments = currentBasket.paymentInstruments;
    var invalid = false;
    var result = {};

    for (var i = 0; i < paymentInstruments.length; i++) {
        var paymentInstrument = paymentInstruments[i];
        var paymentMethod = PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod());
        var paymentMethodID = paymentMethod.getID();

        if (paymentMethodID === KLARNA_PAYMENT_METHOD) {
            if (paymentInstrument.getPaymentTransaction().getAmount().getValue() !== amount.getValue()) {
                invalid = true;
            }
        }
    }

    result.error = invalid;
    return result;
}

server.prepend(
    'SubmitPayment',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var StringUtils = require('dw/util/StringUtils');
        var Money = require('dw/value/Money');

        var isKlarna = request.httpParameterMap.isKlarna.booleanValue;
        var emailFromFillingPage = false;
        var email = '';

        if (!isKlarna) {
            next();
            return;
        }

        var HookMgr = require('dw/system/HookMgr');
        var Resource = require('dw/web/Resource');
        var PaymentMgr = require('dw/order/PaymentMgr');
        var Transaction = require('dw/system/Transaction');
        var AccountModel = require('*/cartridge/models/account');
        var OrderModel = require('*/cartridge/models/order');
        var Locale = require('dw/util/Locale');
        var URLUtils = require('dw/web/URLUtils');
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();

        if (!currentBasket) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            this.emit('route:Complete', req, res);
            return;
        }

        var klarnaForm = server.forms.getForm('klarna');
        var billingForm = server.forms.getForm('billing');
        var viewData = {};

        var paymentCategoryID = klarnaForm.paymentCategory.value;
        var paymentMethodID = billingForm.paymentMethod.value;
        viewData.paymentMethod = {
            value: paymentMethodID,
            htmlName: billingForm.paymentMethod.htmlName
        };

        var billingFormErrors = COHelpers.validateBillingForm(billingForm.addressFields);

        if (Object.keys(billingFormErrors).length) {
            res.json({
                form: billingForm,
                fieldErrors: [billingFormErrors],
                serverErrors: [],
                error: true,
                paymentMethod: viewData.paymentMethod
            });
            this.emit('route:Complete', req, res);
            return;
        }

        viewData.address = {
            firstName: { value: billingForm.addressFields.firstName.value },
            lastName: { value: billingForm.addressFields.lastName.value },
            address1: { value: billingForm.addressFields.address1.value },
            address2: { value: billingForm.addressFields.address2.value },
            city: { value: billingForm.addressFields.city.value },
            postalCode: { value: billingForm.addressFields.postalCode.value },
            countryCode: { value: billingForm.addressFields.country.value }
        };

        if (Object.prototype.hasOwnProperty.call(billingForm.addressFields, 'states')) {
            viewData.address.stateCode = {
                value: billingForm.addressFields.states.stateCode.value
            };
        }


        if (customer.authenticated) {
            email = customer.getProfile().getEmail();
            emailFromFillingPage = false;
        } else {
            email = klarnaForm.email.value;
            emailFromFillingPage = true;
        }

        viewData.email = {
            value: email
        };

        res.setViewData(viewData);

        var billingAddress = currentBasket.billingAddress;
        Transaction.wrap(function () {
            if (!billingAddress) {
                billingAddress = currentBasket.createBillingAddress();
            }

            billingAddress.setFirstName(billingForm.addressFields.firstName.value);
            billingAddress.setLastName(billingForm.addressFields.lastName.value);
            billingAddress.setAddress1(billingForm.addressFields.address1.value);
            billingAddress.setAddress2(billingForm.addressFields.address2.value);
            billingAddress.setCity(billingForm.addressFields.city.value);
            billingAddress.setPostalCode(billingForm.addressFields.postalCode.value);
            billingAddress.setCountryCode(billingForm.addressFields.country.value);
            if (Object.prototype.hasOwnProperty.call(billingForm.addressFields, 'states')) {
                billingAddress.setStateCode(billingForm.addressFields.states.stateCode.value);
            }
            currentBasket.setCustomerEmail(email);
            billingForm.creditCardFields.email.value = email;
        });

        Transaction.wrap(function () {
            HookMgr.callHook('dw.order.calculate', 'calculate', currentBasket);
        });

        var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();
        if (!processor) {
            throw new Error(Resource.msg('error.payment.processor.missing', 'checkout', null));
        }

        var processorResult = null;
        var hook = 'app.payment.processor.' + processor.ID.toLowerCase();
        if (HookMgr.hasHook(hook)) {
            processorResult = HookMgr.callHook('app.payment.processor.' + processor.ID.toLowerCase(), 'Handle', currentBasket);
        } else {
            throw new Error('File of app.payment.processor.' + processor.ID.toLowerCase() + ' hook is missing or the hook is not configured');
        }

        if (processorResult.error) {
            res.json({
                form: billingForm,
                fieldErrors: processorResult.fieldErrors,
                serverErrors: processorResult.serverErrors,
                error: true
            });
            this.emit('route:Complete', req, res);
            return;
        }

        Transaction.wrap(function () {
            processorResult.paymentInstrument.custom.klarnaPaymentCategoryID = paymentCategoryID;
        });

        var usingMultiShipping = false; // Current integration support only single shpping
        req.session.privacyCache.set('usingMultiShipping', usingMultiShipping);

        if (emailFromFillingPage !== null) {
            Transaction.wrap(function () {
                currentBasket.setCustomerEmail(email);
            });
        }

        var currentLocale = Locale.getLocale(req.locale.id);
        var basketModel = new OrderModel(currentBasket, { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' });
        var accountModel = new AccountModel(req.currentCustomer);
        var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
            req,
            accountModel
        );

        Transaction.wrap(function () {
            basketModel.billing.payment.selectedPaymentInstruments[0].amountFormatted = StringUtils.formatMoney(new Money(basketModel.billing.payment.selectedPaymentInstruments[0].amount, currentBasket.getCurrencyCode()));
        });

        res.json({
            renderedPaymentInstruments: renderedStoredPaymentInstrument,
            customer: accountModel,
            order: basketModel,
            form: billingForm,
            error: false
        });
        this.emit('route:Complete', req, res);
    }
);

server.prepend(
    'PlaceOrder',
	function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        return next();
    }

		// Re-validates existing payment instruments
    var validPaymentAmount = validatePaymentAmount(currentBasket);
    if (validPaymentAmount.error) {
        res.json({
            error: true,
            errorStage: {
                stage: 'payment',
                step: 'paymentInstrument'
            },
            errorMessage: Resource.msg('error.payment.not.valid', 'checkout', null)
        });

        this.emit('route:Complete', req, res);
    }

    return next();
}
);

module.exports = server.exports();
