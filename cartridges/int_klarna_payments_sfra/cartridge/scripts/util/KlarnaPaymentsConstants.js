var FRAUD_STATUS = {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    PENDING: 'PENDING',
    ACCEPTED_AFTER_REVIEW: 'ACCEPTED_AFTER_REVIEW',
    REJECTED_AFTER_REVIEW: 'REJECTED_AFTER_REVIEW'
};

var NOTIFY_EVENT_TYPES = {
    FRAUD_RISK_ACCEPTED: 'FRAUD_RISK_ACCEPTED'
};

var CREDIT_CARD_PROCESSOR_ID = 'BASIC_CREDIT';

var PAYMENT_METHOD = 'KLARNA_PAYMENTS';

var ORDER_LINE_TYPE = {
    DISCOUNT: 'discount',
    SHIPPING_FEE: 'shipping_fee',
    SALES_TAX: 'sales_tax',
    PHYSICAL: 'physical',
    SURCHARGE: 'surcharge'
};

var CONTENT_TYPE = 'application/vnd.klarna.internal.emd-v2+json';

module.exports.FRAUD_STATUS = FRAUD_STATUS;
module.exports.NOTIFY_EVENT_TYPES = NOTIFY_EVENT_TYPES;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
module.exports.CREDIT_CARD_PROCESSOR_ID = CREDIT_CARD_PROCESSOR_ID;
module.exports.ORDER_LINE_TYPE = ORDER_LINE_TYPE;
module.exports.CONTENT_TYPE = CONTENT_TYPE;
