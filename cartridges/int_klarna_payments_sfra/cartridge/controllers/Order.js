//Page.js
var page = module.superModule; // require functionality from last controller in the chain with this name
var server = require('server');
var KlarnaSessionManager = require( '~/cartridge/scripts/services/KlarnaSessionManager' );
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');

server.append('Confirm', function(req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.ID);

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: order.getCurrencyCode()
    };
    return next();
});

module.exports = server.exports();