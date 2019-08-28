'use strict';

var page = module.superModule;
var server = require('server');

server.extend(page);

server.append('ToggleMultiShip', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var URLUtils = require('dw/web/URLUtils');
    var collections = require('*/cartridge/scripts/util/collections');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var shippingHelpers = require('*/cartridge/scripts/checkout/shippingHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();
    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return;
    }

    var shipments = currentBasket.shipments;
    var defaultShipment = currentBasket.defaultShipment;
    var usingMultiShipping = req.form.usingMultiShip === 'true';

    req.session.privacyCache.set('usingMultiShipping', usingMultiShipping);

    if (usingMultiShipping) {
        var UUIDUtils = require('dw/util/UUIDUtils');
        // split line items into separate shipments
        Transaction.wrap(function () {
            collections.forEach(shipments, function (shipment) {
                if (shipment.productLineItems.length > 1) {
                    collections.forEach(shipment.productLineItems, function (lineItem, index) {
                        if (index > 0) {
                            var uuid = UUIDUtils.createUUID();
                            var newShipment = currentBasket.createShipment(uuid);
                            // only true if customer is registered
                            if (req.currentCustomer.addressBook && req.currentCustomer.addressBook.preferredAddress) {
                                var preferredAddress = req.currentCustomer.addressBook.preferredAddress;
                                COHelpers.copyCustomerAddressToShipment(preferredAddress, newShipment);
                            }

                            shippingHelpers.selectShippingMethod(newShipment);
                            lineItem.setShipment(newShipment);
                        }
                    });
                }
            });

            shippingHelpers.selectShippingMethod(defaultShipment);
            defaultShipment.createShippingAddress();

            COHelpers.ensureNoEmptyShipments(req);

            basketCalculationHelpers.calculateTotals(currentBasket);
        });
    }

    next();
});

/**
 * Handle Ajax shipping form submit
 */
server.prepend(
    'SubmitShipping',
    server.middleware.https,
    function (req, res, next) {
        var KlarnaSessionManager = require('*/cartridge/scripts/common/KlarnaSessionManager');
        var KlarnaLocale = require('*/cartridge/scripts/klarna_payments/locale');
        var userSession = req.session.raw;

        var klarnaSessionManager = new KlarnaSessionManager(userSession, new KlarnaLocale());
        klarnaSessionManager.createOrUpdateSession();

        return next();
    }
);


module.exports = server.exports();
