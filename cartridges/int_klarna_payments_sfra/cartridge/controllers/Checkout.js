var page = module.superModule; // inherits functionality
var server = require('server');
var KlarnaSessionManager = require('~/cartridge/scripts/common/KlarnaSessionManager');
var BasketMgr = require('dw/order/BasketMgr');

server.extend(page);

server.append('Begin', function (req, res, next) {
    var userSession = req.session.raw;
    var localeId = req.locale.id;
    var currentBasket = BasketMgr.getCurrentBasket();

    var klarnaSessionManager = new KlarnaSessionManager(userSession, localeId);
    klarnaSessionManager.createOrUpdateSession();

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');

    return next();
});

module.exports = server.exports();
