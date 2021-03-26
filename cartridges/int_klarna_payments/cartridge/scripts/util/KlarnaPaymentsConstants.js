var FRAUD_STATUS = {
    ACCEPTED : 'ACCEPTED',
    REJECTED : 'REJECTED',
    PENDING : 'PENDING',
    ACCEPTED_AFTER_REVIEW : 'ACCEPTED_AFTER_REVIEW',
    REJECTED_AFTER_REVIEW : 'REJECTED_AFTER_REVIEW'
}

var FRAUD_STATUS_MAP = {
    ACCEPTED: 'FRAUD_RISK_ACCEPTED',
    REJECTED: 'FRAUD_RISK_REJECTED'
};

var PAYMENT_METHOD = 'Klarna';

var ORDER_LINE_TYPE = {
    DISCOUNT : 'discount',
    SHIPPING_FEE : 'shipping_fee',
    SALES_TAX : 'sales_tax',
    PHYSICAL : 'physical',
    SURCHARGE : 'surcharge',
    GIFT_CERTIFICATE : 'gift_card',
    GIFT_CERTIFICATE_PI : 'store_credit'
}

var CONTENT_TYPE = 'application/vnd.klarna.internal.emd-v2+json';

var SHIPPING_METHOD_TYPE = {
    STORE: 'store pick-up',
    POINT: 'pick-up point',
    REGBOX: 'registered box',
    UREGBOX: 'unregistered box'
};

var SHIPPING_TYPE = {
    NORMAL: 'normal',
    EXPRESS: 'express'
};

var KLARNA_PAYMENT_URLS = {
    CREATE_SESSION: 'KlarnaPayments-CreateSession',
    UPDATE_SESSION: 'KlarnaPayments-UpdateSession',
    CLEAR_SESSION: 'KlarnaPayments-ClearSession',
    SAVE_AUTH: 'KlarnaPayments-SaveAuth',
    LOAD_AUTH: '',
    SELECT_PAYMENT_METHOD: 'KlarnaPayments-SelectPaymentMethod',
    CONFIRMATION: 'KlarnaPayments-Confirmation',
    NOTIFICATION: 'KlarnaPayments-Notification'
}

var SERVICE_HEADER = 'SFCC SG Klarna Payments 21.1.1';

module.exports.FRAUD_STATUS = FRAUD_STATUS;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
module.exports.ORDER_LINE_TYPE = ORDER_LINE_TYPE;
module.exports.CONTENT_TYPE = CONTENT_TYPE;
module.exports.FRAUD_STATUS_MAP = FRAUD_STATUS_MAP;
module.exports.SHIPPING_METHOD_TYPE = SHIPPING_METHOD_TYPE;
module.exports.SHIPPING_TYPE = SHIPPING_TYPE;
module.exports.KLARNA_PAYMENT_URLS = KLARNA_PAYMENT_URLS;
module.exports.SERVICE_HEADER = SERVICE_HEADER;
