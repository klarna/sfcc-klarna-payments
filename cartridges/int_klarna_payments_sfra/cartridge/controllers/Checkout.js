//Page.js
var page = module.superModule; // require functionality from last controller in the chain with this name
var server = require('server');
var KlarnaSessionManager = require( '~/cartridge/scripts/services/KlarnaSessionManager' );
var Transaction = require('dw/system/Transaction');
var BasketMgr = require('dw/order/BasketMgr');

server.append('Begin', function(req, res, next) {
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