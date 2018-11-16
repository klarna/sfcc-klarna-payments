var page = module.superModule; //inherits functionality from next Product.js found to the right on the cartridge path
var server = require('server');
var KlarnaSessionManager = require('~/cartridge/scripts/common/KlarnaSessionManager');
var BasketMgr = require('dw/order/BasketMgr');

server.append('Begin', function (req, res, next) {
    var userSession = request.session;
    var locale = request.locale;
    var currentBasket = BasketMgr.getCurrentBasket();

    var klarnaSessionManager = new KlarnaSessionManager(userSession, locale);
    klarnaSessionManager.createOrUpdateSession();

    var userSession = request.session;

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');

    return next();
});

module.exports = server.exports();
