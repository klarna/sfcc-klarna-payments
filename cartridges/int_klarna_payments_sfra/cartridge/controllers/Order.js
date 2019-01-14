var page = module.superModule; // inherits functionality
var server = require('server');
var KlarnaUtils = require('~/cartridge/scripts/util/KlarnaUtils');

server.extend(page);

server.append('Confirm', function (req, res, next) {
    var OrderMgr = require('dw/order/OrderMgr');
    var order = OrderMgr.getOrder(req.querystring.ID);

    var viewData = res.getViewData();
    viewData.klarna = {
        currency: order.getCurrencyCode()
    };
    return next();
});

module.exports = server.exports();
