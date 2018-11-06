'use strict';

var page = module.superModule;
var server = require('server');

var KlarnaPayments = {
	httpService 			: require( '~/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( '~/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( '~/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( '~/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};

var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.extend(page);

server.prepend(
    'SubmitPayment', 
    server.middleware.https, 
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var isKlarna = request.httpParameterMap.isKlarna.booleanValue;

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
            var email = customer.getProfile().getEmail();
            var emailFromFillingPage = false;
        } else {
            var email = klarnaForm.email.value;
            var emailFromFillingPage = true;
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

        Transaction.wrap(function() {
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

        Transaction.wrap(function() {
            basketModel.billing.payment.selectedPaymentInstruments[0].amountFormatted = dw.util.StringUtils.formatMoney(new dw.value.Money(basketModel.billing.payment.selectedPaymentInstruments[0].amount, currentBasket.getCurrencyCode()));
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

module.exports = server.exports();