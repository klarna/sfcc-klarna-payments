var page = module.superModule; // inherits functionality
var server = require('server');
var BasketMgr = require('dw/order/BasketMgr');
var KlarnaSessionManager = require('~/cartridge/scripts/common/KlarnaSessionManager');
var KlarnaLocale = require('~/cartridge/scripts/klarna_payments/locale');
var KlarnaUtils = require('~/cartridge/scripts/util/KlarnaUtils');

server.extend(page);

server.append('Begin', function (req, res, next) {
    var userSession = req.session.raw;
    var currentBasket = BasketMgr.getCurrentBasket();
    var viewData = res.getViewData();

    var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());

    klarnaSessionManager.createOrUpdateSession();

    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');
    viewData.klarnaPaymentMethodName = KlarnaUtils.getKlarnaPaymentMethodName();

    return next();
});

module.exports = server.exports();
