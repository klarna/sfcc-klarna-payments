var page = module.superModule; // inherits functionality
var server = require('server');
var URLUtils = require('dw/web/URLUtils');
var Resource = require('dw/web/Resource');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');

server.extend(page);

server.replace('Confirm', function (req, res, next) {
    var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
    var OrderMgr = require('dw/order/OrderMgr');
    var OrderModel = require('*/cartridge/models/order');
    var Locale = require('dw/util/Locale');
    var BasketMgr = require('dw/order/BasketMgr');

    var order = OrderMgr.getOrder(req.querystring.ID);

    if (!order || order.customer.ID !== req.currentCustomer.raw.ID) {
        res.render('/error', {
            message: Resource.msg('error.confirmation.error', 'confirmation', null)
        });

        return next();
    }
    var lastOrderID = Object.prototype.hasOwnProperty.call(req.session.raw.custom, 'orderID') ? req.session.raw.custom.orderID : null;
    if (lastOrderID === req.querystring.ID) {
        res.redirect(URLUtils.url('Home-Show'));
        return next();
    }

    var config = {
        numberOfLineItems: '*'
    };

    var currentLocale = Locale.getLocale(req.locale.id);

    var orderModel = new OrderModel(
        order,
        { config: config, countryCode: currentLocale.country, containerView: 'order' }
    );
    var passwordForm;

    var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: order.getCurrencyCode()
    };

    if (!req.currentCustomer.profile) {
        passwordForm = server.forms.getForm('newPasswords');
        passwordForm.clear();
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: false,
            passwordForm: passwordForm,
            reportingURLs: reportingURLs,
            orderUUID: order.getUUID()
        });
    } else {
        res.render('checkout/confirmation/confirmation', {
            order: orderModel,
            returningCustomer: true,
            reportingURLs: reportingURLs,
            orderUUID: order.getUUID()
        });
    }
    req.session.raw.custom.orderID = req.querystring.ID; // eslint-disable-line no-param-reassign

    //revert cart data in case of klarna buy now pdp
    var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
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
