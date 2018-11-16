var page = module.superModule; //inherits functionality from next Product.js found to the right on the cartridge path
var server = require('server');

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
