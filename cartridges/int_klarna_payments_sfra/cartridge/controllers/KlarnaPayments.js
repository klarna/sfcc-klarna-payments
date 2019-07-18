'use strict';

var server = require('server');

var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');

server.post('Notification', function (req, res) {
    var StringUtils = require('dw/util/StringUtils');
    var OrderMgr = require('dw/order/OrderMgr');
    var processor = require('*/cartridge/scripts/klarna_payments/processor');

    var requestParams = req.form;

    var klarnaPaymentsFraudDecisionObject = JSON.parse(req.body);

    var kpOrderID = klarnaPaymentsFraudDecisionObject.order_id;
    var kpEventType = klarnaPaymentsFraudDecisionObject.event_type;
    var currentCountry = requestParams.klarna_country;
    var order = OrderMgr.queryOrder('custom.kpOrderID = {0}', kpOrderID);

    StringUtils.format('Notification received: requestBody=[{0}]', req.body);

    if (!order) {
        res.setStatusCode(200);
    }

    try {
        processor.notify(order, kpOrderID, kpEventType, currentCountry);

        res.setStatusCode(200);
    } catch (e) {
        log.error(e);
    }
});

server.get('SaveAuth', function (req, res) {
    var KlarnaLocale = require('*/cartridge/scripts/klarna_payments/locale');
    var KlarnaSessionManager = require('*/cartridge/scripts/common/KlarnaSessionManager');

    var token = req.httpHeaders['x-auth'];
    var finalizeRequired = req.httpHeaders['finalize-required'];
    var userSession = req.session.raw;

    var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());
    klarnaSessionManager.saveAuthorizationToken(token, finalizeRequired);

    res.setStatusCode(200);
});

server.get('LoadAuth', function (req, res) {
    var KlarnaLocale = require('*/cartridge/scripts/klarna_payments/locale');
    var KlarnaSessionManager = require('*/cartridge/scripts/common/KlarnaSessionManager');
    var userSession = req.session.raw;

    var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());
    var authInfo = klarnaSessionManager.loadAuthorizationInfo();

    res.json(authInfo);

    res.setStatusCode(200);

    this.emit('route:Complete', req, res);
});

server.get('RefreshSession', function (req, res) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/KlarnaSessionManager');
    var KlarnaLocale = require('*/cartridge/scripts/klarna_payments/locale');

    var userSession = req.session.raw;

    var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());
    var response = klarnaSessionManager.createOrUpdateSession();

    res.json({
        klarna: response,
        paymentMethodHtmlName: server.forms.getForm('billing').paymentMethod.htmlName,
        paymentCategoryHtmlName: server.forms.getForm('klarna').paymentCategory.htmlName
    });

    res.setStatusCode(200);

    this.emit('route:Complete', req, res);
});

module.exports = server.exports();
