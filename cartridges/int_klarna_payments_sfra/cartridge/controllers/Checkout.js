var page = module.superModule; // inherits functionality
var server = require('server');

server.extend(page);

server.prepend('Begin', function (req, res, next) {
    var KlarnaSessionManager = require('*/cartridge/scripts/common/klarnaSessionManager');
    var BasketMgr = require('dw/order/BasketMgr');
    var URLUtils = require('dw/web/URLUtils');
    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket && currentBasket.defaultShipment.shippingMethod === null) {
        res.redirect(URLUtils.url('Cart-Show'));
        return next();
    }

    // Create or update session before base call,
    // as we'll need the token & ID form basket object
    var klarnaSessionManager = new KlarnaSessionManager();
    klarnaSessionManager.createOrUpdateSession();

    return next();
});

server.append('Begin', function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    var viewData = res.getViewData();

    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');

    return next();
});

module.exports = server.exports();
