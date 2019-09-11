'use strict';

var proxyquire = require('proxyquire').noCallThru().noPreserveCache();
var collections = require('../util/collections');

function proxyModel() {
    return proxyquire('../../../cartridges/int_klarna_payments_sfra/cartridge/models/payment', {
        '*/cartridge/scripts/util/collections': collections,
        '*/cartridge/scripts/util/KlarnaPaymentsConstants': require('../../../cartridges/int_klarna_payments_sfra/cartridge/scripts/util/KlarnaPaymentsConstants'),
        'dw/order/PaymentMgr': {
            getApplicablePaymentMethods: function () {
                return [
                    {
                        ID: 'GIFT_CERTIFICATE',
                        name: 'Gift Certificate'
                    },
                    {
                        ID: 'CREDIT_CARD',
                        name: 'Credit Card'
                    }
                ];
            },
            getPaymentMethod: function () {
                return {
                    getApplicablePaymentCards: function () {
                        return [
                            {
                                cardType: 'Visa',
                                name: 'Visa',
                                UUID: 'some UUID'
                            },
                            {
                                cardType: 'Amex',
                                name: 'American Express',
                                UUID: 'some UUID'
                            },
                            {
                                cardType: 'Master Card',
                                name: 'MasterCard'
                            },
                            {
                                cardType: 'Discover',
                                name: 'Discover'
                            }
                        ];
                    }
                };
            },
            getApplicablePaymentCards: function () {
                return ['applicable payment cards'];
            }
        },
        'dw/order/PaymentInstrument': {}
    });
}

module.exports = proxyModel();