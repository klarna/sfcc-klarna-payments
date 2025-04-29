var page = module.superModule; // inherits functionality
var server = require('server');
var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

server.extend(page);

/**
 * Order-Confirm: This endpoint has been extended to restore the customer's previous basket
 * based on the session attribute, in case of a Klarna Buy Now on the PDP
 */
server.append('Confirm', server.middleware.https, function (req, res, next) {
    if (!KlarnaHelper.isCurrentCountryKlarnaEnabled()) {
        return next();
    }
    var OrderMgr = require('dw/order/OrderMgr');
    var BasketMgr = require('dw/order/BasketMgr');

    var order = OrderMgr.getOrder(req.form.orderID, req.form.orderToken);

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: order.getCurrencyCode()
    };

    // Remove Klarna sign-in access token from the customer profile for customers using SIWK once the order confirmation page is displayed
    var CustomerMgr = require('dw/customer/CustomerMgr');
    var KlarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');
    if (KlarnaOSM.isKlarnaSignInEnabled()) {
        var customer = order.customer;
        var customerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile('Klarna', customer && customer.profile && customer.profile.email);
        if (customerProfile && customerProfile.custom.klarnaSignInAccessToken) {
            customerProfile.custom.klarnaSignInAccessToken = '';
        }
    }

    //revert cart data in case of klarna buy now pdp
    var currentBasket = BasketMgr.getCurrentOrNewBasket();
    try {
        KlarnaHelper.revertCurrentBasketProductData(currentBasket);
    } catch (e) {
        dw.system.Logger.error("Couldn't revert basket data - " + e);
    }
    session.privacy.kpCustomerProductData = null;

    return next();
});

server.get('Subscriptions', server.middleware.https, userLoggedIn.validateLoggedIn, function (req, res, next) {
    var customer = req.currentCustomer.raw;
    var breadcrumbs = [
        {
            htmlValue: Resource.msg('global.home', 'common', null),
            url: URLUtils.home().toString()
        },
        {
            htmlValue: Resource.msg('page.title.myaccount', 'account', null),
            url: URLUtils.url('Account-Show').toString()
        }
    ];

    var subscriptions = customer.profile.custom.kpSubscriptions ? JSON.parse(customer.profile.custom.kpSubscriptions) : [];

    res.render("account/subscriptionHistory", {
        subscriptions: subscriptions,
        breadcrumbs: breadcrumbs,
        accountlanding: false
    });
    next();
});

module.exports = server.exports();
