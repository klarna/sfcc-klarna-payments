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
                return new ArrayList([
                    {
                        ID: 'GIFT_CERTIFICATE',
                        name: 'Gift Certificate'
                    },
                    {
                        ID: 'CREDIT_CARD',
                        name: 'Credit Card'
                    },
                    {
                        ID: 'KLARNA_PAYMENTS',
                        name: 'Klarna Payments'
                    },
                    {
                        ID: 'NOT_APPLICABLE_KLARNA_PAYMENTS',
                        name: 'Not Applicable Klarna Payments'
                    }
                ]);
            },
            getPaymentMethod: function () {
                return {
                    getApplicablePaymentCards: function () {
                        return new ArrayList([
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
                        ]);
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
