'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var collections = require('../util/collections');
var ArrayList = require('../dw.util.Collection');
function proxyModel() {
    return proxyquire('../../../cartridges/int_klarna_payments_sfra/cartridge/models/payment', {
        '*/cartridge/scripts/util/collections': collections,
        '*/cartridge/scripts/util/klarnaPaymentsConstants': require('../util/klarnaPaymentsConstants'),
        '*/cartridge/scripts/util/klarnaHelper': require('../util/klarnaHelper'),
        'dw/util/ArrayList': ArrayList,
        'dw/order/PaymentMgr': {
            getApplicablePaymentMethods: function () {
                return null;
            },
            getPaymentMethod: function () {
                return {
                    getApplicablePaymentCards: function () {
                        return null;
                    }
                };
            },
            getApplicablePaymentCards: function () {
                return null;
            }
        },
        'dw/order/PaymentInstrument': { METHOD_CREDIT_CARD: 'CREDIT_CARD' }
    });
}

module.exports = proxyModel();
