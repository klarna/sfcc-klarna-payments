var page = module.superModule; // inherits functionality
var server = require('server');
var BasketMgr = require('dw/order/BasketMgr');

server.extend(page);

server.append('Begin', function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: currentBasket.getCurrencyCode()
    };
    viewData.klarnaForm = server.forms.getForm('klarna');

    return next();
});

module.exports = server.exports();
