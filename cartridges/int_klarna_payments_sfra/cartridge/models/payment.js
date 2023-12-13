'use strict';

var PaymentMgr = require('dw/order/PaymentMgr');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var collections = require('*/cartridge/scripts/util/collections');
var ArrayList = require('dw/util/ArrayList');

var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');
var KLARNA_PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
var KLARNA_PAYMENT_DEFAULT = require('*/cartridge/scripts/util/klarnaPaymentsConstants').PAYMENT_METHOD;

/**
 * Creates an array of objects containing applicable payment methods
 * @param {dw.util.ArrayList<dw.order.dw.order.PaymentMethod>} paymentMethods - An ArrayList of
 *      applicable payment methods that the user could use for the current basket.
 * @returns {Array} of object that contain information about the applicable payment methods for the
 *      current cart
 */
function applicablePaymentMethods(paymentMethods) {
    var result = new ArrayList();
    var iterator = paymentMethods.iterator();
    var method;
    while (iterator.hasNext()) {
        method = iterator.next();
        if (method.ID.indexOf(KLARNA_PAYMENT_DEFAULT) === -1 ||
            (method.ID.indexOf(KLARNA_PAYMENT_DEFAULT) >= 0 && method.ID === KLARNA_PAYMENT_METHOD)) {
            result.add({
                ID: method.ID,
                name: method.name
            });
        }
    }
    return result;
}

/**
 * Creates an array of objects containing applicable credit cards
 * @param {dw.util.Collection<dw.order.PaymentCard>} paymentCards - An ArrayList of applicable
 *      payment cards that the user could use for the current basket.
 * @returns {Array} Array of objects that contain information about applicable payment cards for
 *      current basket.
 */
function applicablePaymentCards(paymentCards) {
    return collections.map(paymentCards, function (card) {
        return {
            cardType: card.cardType,
            name: card.name
        };
    });
}

/**
 * Creates an array of objects containing selected payment information
 * @param {dw.util.ArrayList<dw.order.PaymentInstrument>} selectedPaymentInstruments - ArrayList
 *      of payment instruments that the user is using to pay for the current basket
 * @returns {Array} Array of objects that contain information about the selected payment instruments
 */
function getSelectedPaymentInstruments(selectedPaymentInstruments, currencyCode) {
    return collections.map(selectedPaymentInstruments, function (paymentInstrument) {
        var results = {
            paymentMethod: paymentInstrument.paymentMethod,
            amount: paymentInstrument.paymentTransaction.amount.value
        };

        if (paymentInstrument.paymentMethod === 'CREDIT_CARD') {
            results.lastFour = paymentInstrument.creditCardNumberLastDigits;
            results.owner = paymentInstrument.creditCardHolder;
            results.expirationYear = paymentInstrument.creditCardExpirationYear;
            results.type = paymentInstrument.creditCardType;
            results.maskedCreditCardNumber = paymentInstrument.maskedCreditCardNumber;
            results.expirationMonth = paymentInstrument.creditCardExpirationMonth;
        } else if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE') {
            results.giftCertificateCode = paymentInstrument.giftCertificateCode;
            results.maskedGiftCertificateCode = paymentInstrument.maskedGiftCertificateCode;
        } else if (paymentInstrument.paymentMethod === KLARNA_PAYMENT_METHOD) {
            results.paymentCategory = paymentInstrument.custom.klarnaPaymentCategoryID;
            results.categoryName = paymentInstrument.custom.klarnaPaymentCategoryName;
        }
        results.currencyCode = currencyCode;

        return results;
    });
}

/**
 * Payment class that represents payment information for the current basket
 * @param {dw.order.Basket} currentBasket - the target Basket object
 * @param {dw.customer.Customer} currentCustomer - the associated Customer object
 * @param {string} countryCode - the associated Site countryCode
 * @constructor
 */
function Payment(currentBasket, currentCustomer, countryCode) {
    var paymentAmount = currentBasket.totalGrossPrice;
    var paymentMethods = PaymentMgr.getApplicablePaymentMethods(
        currentCustomer,
        countryCode,
        paymentAmount.value
	);

    var paymentCards = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD)
	.getApplicablePaymentCards(currentCustomer, countryCode, paymentAmount.value);
    var paymentInstruments = currentBasket.paymentInstruments;

    this.applicablePaymentMethods =
	paymentMethods ? applicablePaymentMethods(paymentMethods) : null;

    this.applicablePaymentCards =
	paymentCards ? applicablePaymentCards(paymentCards) : null;

    this.selectedPaymentInstruments = paymentInstruments ?
	getSelectedPaymentInstruments(paymentInstruments, currentBasket.currencyCode) : null;
}

module.exports = Payment;
