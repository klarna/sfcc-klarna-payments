
function getPaymentMethod( ) {
    var PAYMENT_METHOD = require( './klarnaPaymentsConstants' ).PAYMENT_METHOD;
    return PAYMENT_METHOD;
}

exports.getPaymentMethod = getPaymentMethod;