var FRAUD_STATUS = {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    PENDING: 'PENDING',
    ACCEPTED_AFTER_REVIEW: 'ACCEPTED_AFTER_REVIEW',
    REJECTED_AFTER_REVIEW: 'REJECTED_AFTER_REVIEW'
};

var FRAUD_STATUS_MAP = {
    ACCEPTED: 'FRAUD_RISK_ACCEPTED',
    REJECTED: 'FRAUD_RISK_REJECTED'
};

var NOTIFY_EVENT_TYPES = {
    FRAUD_RISK_ACCEPTED: 'FRAUD_RISK_ACCEPTED'
};

var CREDIT_CARD_PROCESSOR_ID = 'basic_credit';

var PAYMENT_METHOD = 'KLARNA_PAYMENTS';

var ORDER_LINE_TYPE = {
    DISCOUNT: 'discount',
    SHIPPING_FEE: 'shipping_fee',
    SALES_TAX: 'sales_tax',
    PHYSICAL: 'physical',
    SURCHARGE: 'surcharge',
    GIFT_CERTIFICATE: 'gift_card',
    GIFT_CERTIFICATE_PI: 'store_credit'
};

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
    CREATE_SESSION: '',
    UPDATE_SESSION: 'KlarnaPayments-RefreshSession',
    CLEAR_SESSION: '',
    SAVE_AUTH: 'KlarnaPayments-SaveAuth',
    LOAD_AUTH: 'KlarnaPayments-LoadAuth',
    SELECT_PAYMENT_METHOD: 'KlarnaPayments-SelectPaymentMethod',
    CONFIRMATION: 'Order-Confirm',
    NOTIFICATION: 'KlarnaPayments-Notification'
};

var SERVICE_HEADER = 'SFCC SFRA Klarna Payments 21.1.2';

module.exports.FRAUD_STATUS = FRAUD_STATUS;
module.exports.NOTIFY_EVENT_TYPES = NOTIFY_EVENT_TYPES;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
module.exports.CREDIT_CARD_PROCESSOR_ID = CREDIT_CARD_PROCESSOR_ID;
module.exports.ORDER_LINE_TYPE = ORDER_LINE_TYPE;
module.exports.CONTENT_TYPE = CONTENT_TYPE;
module.exports.FRAUD_STATUS_MAP = FRAUD_STATUS_MAP;
module.exports.SHIPPING_METHOD_TYPE = SHIPPING_METHOD_TYPE;
module.exports.SHIPPING_TYPE = SHIPPING_TYPE;
module.exports.KLARNA_PAYMENT_URLS = KLARNA_PAYMENT_URLS;
module.exports.SERVICE_HEADER = SERVICE_HEADER;
