/* globals empty, session, request, dw */
'use strict';

var server = require('server');

var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');

var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

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

    // If there was no authorization token and finalization is required,
    // then we need to show the form
    if (!token && finalizeRequired) {
        session.privacy.KPAuthInfo = JSON.stringify({
            FinalizeRequired: finalizeRequired
        });
    } else { // else we need to finalize the authorization
        var klarnaSessionManager = new KlarnaSessionManager();
        klarnaSessionManager.saveAuthorizationToken(token, finalizeRequired);
    }
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

server.post('BankTransferCallback', function (req, res) {
    // Get Order ID from Klarna session_id
    var OrderMgr = require('dw/order/OrderMgr');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var processor = require('*/cartridge/scripts/payments/processor');
    var klarnaResponse = JSON.parse(req.body);
    var kpAuthorizationToken = klarnaResponse.authorization_token;
    var kpSessionId = klarnaResponse.session_id;
    KlarnaHelper.isCurrentCountryKlarnaEnabled();

    // Get Order by sessionId with status CREATED and update its status
    try {
        var order = OrderMgr.queryOrder('custom.kpSessionId = {0} AND status = {1}', kpSessionId, dw.order.Order.ORDER_STATUS_CREATED);
        if (order) {
            processor.bankTransferPlaceOrder(order, kpSessionId, kpAuthorizationToken);
        }
    } catch (e) {
        log.error('BT Callback error: ' + e);
    }

    // If this callback is not fired, then
    // the Order will not be updated (status = NOT_PAID)
    res.setStatusCode(200);
});

server.get('BankTransferAwaitCallback', function (req, res, next) {
    var kpSessionId = req.querystring.session_id;
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.queryOrder('custom.kpSessionId = {0}', kpSessionId);
    var isSubscriptionOrder = false;

    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
    var subscriptionData = SubscriptionHelper.getSubscriptionData(order);
    if (subscriptionData && subscriptionData.subscriptionTrialPeriod) {
        isSubscriptionOrder = true;
    }

    res.json({
        redirectUrl: order.custom.kpRedirectURL,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        isSubscriptionOrder: isSubscriptionOrder
    });
    return next();
});

/**
 * Fail current Order using Klarna session_id in order to
 * recreate Basket on Klarna Payments change
 **/
server.post('FailOrder', function (req, res, next) {
    var kpSessionId = req.querystring.session_id;
    var OrderMgr = require('dw/order/OrderMgr');
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');

    var order = OrderMgr.queryOrder('custom.kpSessionId = {0} AND status = {1}', kpSessionId, dw.order.Order.ORDER_STATUS_CREATED);
    var result = true;
    // Fail Order and recreate Basket
    Transaction.wrap(function () {
        result = OrderMgr.failOrder(order, true);
    });

    res.json({ success: true });
    var currentBasket = BasketMgr.getCurrentBasket();
    // In case of failure and no Basket, return error
    if (!currentBasket && result.error) {
        res.json({ success: false });
    }
    res.setStatusCode(200);
    return next();
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

server.get('CancelSubscription', userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var subid = req.querystring.subid;
    var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');

    var klarnaCreateCustomerTokenResponse = SubscriptionHelper.cancelSubscription(subid);

    if (klarnaCreateCustomerTokenResponse.response) {
        var SubscriptionHelper = require('*/cartridge/scripts/subscription/subscriptionHelper');
        var isDisabled = SubscriptionHelper.disableCustomerSubscription(subid);

        res.json({
            error: !isDisabled,
            statusMsg: Resource.msg('label.subscriptions.status.inactive', 'subscription', null),
            message: Resource.msgf('msg.cancel.success', 'subscription', null, subid)
        });
    } else {
        res.json({
            error: true,
            message: Resource.msgf('msg.cancel.error', 'subscription', null, subid)
        });
    }

    return next();
});

/**
 * Endpoint to handle authorization callback
 * for Klarna express checkout
 */
server.post('ECAuthorizationCallback', function (req, res, next) {
    //TODO handle authorization callback if needed
    res.json({
        success: true

    });
    return next();
});

/**
 * Handle authorization result callback, 
 * validate basket and redirect customer
 * to the proper checkout page
 */
server.post('HandleAuthorizationResult', function (req, res, next) {
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
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var Site = require('dw/system/Site');

    var klarnaResponse = req.body ? JSON.parse(req.body) : null;

    if (!klarnaResponse) {
        res.json({
            success: false,
            errorMessage: 'Missing response.',
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var EXPRESS_CHECKOUT_CATEGORY = KlarnaHelper.getExpressKlarnaMethod().defaultMethod;
    var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            success: false,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var klarnaDetails = KlarnaHelper.mapKlarnaExpressAddress(klarnaResponse.collected_shipping_address);

    var klarnaSessionId = null;
    Transaction.wrap(function () {
        currentBasket.custom.kpClientToken = klarnaResponse.client_token;
        currentBasket.custom.kpSessionId = klarnaSessionId;
        currentBasket.custom.kpIsExpressCheckout = true;
        currentBasket.customerEmail = klarnaResponse.collected_shipping_address ? klarnaResponse.collected_shipping_address.email : '';
    });

    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.saveAuthorizationToken(klarnaResponse.authorization_token, klarnaResponse.finalize_required.toString());

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error || !validatedProducts.hasInventory) {
        res.json({
            success: false,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    // Get current shipments
    var shipments = currentBasket.shipments;

    // Pre-populate shipping details
    var hasShippingMethod = true;
    collections.forEach(shipments, function (shipment) {
        // Pre-populate address details if not already present
        // Don't update it on store pickup shipments as this is the store address
        if (empty(shipment.custom.fromStoreId) && klarnaDetails) {
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
    if (klarnaDetails) {
        KlarnaHelper.setExpressBilling(currentBasket, klarnaDetails);
    }

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
        res.json({
            success: false,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var stage = 'payment';
    if (!klarnaDetails) {
        //Redirect to customer section if we don't have the email and the address data
        stage = 'customer';
    }
    if (!hasShippingMethod) {
        // Redirect to shipping section if we don't have all shipping methods
        stage = 'shipping';
    }

    session.privacy.KlarnaExpressCategory = EXPRESS_CHECKOUT_CATEGORY;
    res.json({
        success: true,
        redirectUrl: URLUtils.url('Checkout-Begin', 'stage', stage).toString()

    });
    return next();
});

/**
 * Genereate payload for Klarna express checkout
 * authorization call,
 * validate and calculate cart
 */
server.post('GenerateExpressCheckoutPayload', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
    var Transaction = require('dw/system/Transaction');
    var cartHelper = require('*/cartridge/scripts/cart/cartHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var URLUtils = require('dw/web/URLUtils');
    var localeObject = KlarnaHelper.getLocale();
    var isPDP = request.httpParameterMap.isPDP.value === 'true';
    var currentBasket;

    if (isPDP) {
        currentBasket = BasketMgr.getCurrentOrNewBasket();
        var currentBasketData = null;

        if (currentBasket) {
            Transaction.wrap(function () {
                currentBasketData = KlarnaHelper.getCurrentBasketProductData(currentBasket);
                session.privacy.kpCustomerProductData = JSON.stringify(currentBasketData);
            });
        }

        var form = req.form;
        var productId = req.form.pid;
        var childProducts = Object.hasOwnProperty.call(req.form, 'childProducts')
            ? JSON.parse(req.form.childProducts)
            : [];
        var options = req.form.options ? JSON.parse(req.form.options) : [];
        var quantity = parseInt(req.form.quantity, 10);

        Transaction.wrap(function () {
            if (!req.form.pidsObj) {
                var result = cartHelper.addProductToCart(
                    currentBasket,
                    productId,
                    quantity,
                    childProducts,
                    options
                );
            } else {
                // product set
                pidsObj = JSON.parse(req.form.pidsObj);
                result = {
                    error: false,
                    message: Resource.msg('text.alert.addedtobasket', 'product', null)
                };

                pidsObj.forEach(function (PIDObj) {
                    quantity = parseInt(PIDObj.qty, 10);
                    var pidOptions = PIDObj.options ? JSON.parse(PIDObj.options) : {};
                    var PIDObjResult = cartHelper.addProductToCart(
                        currentBasket,
                        PIDObj.pid,
                        quantity,
                        childProducts,
                        pidOptions
                    );
                    if (PIDObjResult.error) {
                        result.error = PIDObjResult.error;
                        result.message = PIDObjResult.message;
                    }
                });
            }
            if (!result.error) {
                cartHelper.ensureAllShipmentsHaveMethods(currentBasket);
            }
        });
    } else {
        currentBasket = BasketMgr.getCurrentBasket();

        if (!currentBasket) {
            res.json({
                success: false,
                redirectUrl: URLUtils.url('Cart-Show').toString()

            });
            return next();
        }
    }

    if (currentBasket && currentBasket.defaultShipment.shippingMethod === null) {
        res.json({
            success: false,
            redirectUrl: URLUtils.url('Cart-Show').toString()

        });
        return next();
    }

    COHelpers.recalculateBasket(currentBasket);

    var validatedProducts = validationHelpers.validateProducts(currentBasket);
    if (validatedProducts.error || !validatedProducts.hasInventory) {
        res.json({
            success: false,
            redirectUrl: URLUtils.url('Cart-Show').toString()

        });
        return next();
    }

    var sessionBuilder = require('*/cartridge/scripts/payments/requestBuilder/session');
    var sessionRequestBuilder = new sessionBuilder();
    var populateAddress = request.httpParameterMap.populateAddress.value || 'false';

    sessionRequestBuilder.setParams({
        basket: currentBasket,
        localeObject: localeObject,
        kpIsExpressCheckout: populateAddress === 'true'
    });

    var requestBody = sessionRequestBuilder.build();
    res.json({
        success: true,
        payload: requestBody
    });

    return next();

});

/**
 * Handle authorization failures - revert customer
 * basket in case of express checkout on pdp
 */
server.get('HandleAuthFailure', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

    var currentBasket = BasketMgr.getCurrentBasket();
    try {
        KlarnaHelper.revertCurrentBasketProductData(currentBasket);
        res.json({
            success: true
        });
    } catch (e) {
        res.json({
            success: false
        });
        Logger.error(e);
    }
    return next();
});

module.exports = server.exports();
