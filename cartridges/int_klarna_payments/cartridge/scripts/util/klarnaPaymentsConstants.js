var FRAUD_STATUS = {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    PENDING: 'PENDING',
    ACCEPTED_AFTER_REVIEW: 'ACCEPTED_AFTER_REVIEW',
    REJECTED_AFTER_REVIEW: 'REJECTED_AFTER_REVIEW'
}

var FRAUD_STATUS_MAP = {
    ACCEPTED: 'FRAUD_RISK_ACCEPTED',
    REJECTED: 'FRAUD_RISK_REJECTED'
};

var PAYMENT_METHOD = 'Klarna';
var KLARNA_SERVICE = 'klarna.http.defaultendpoint';

var ORDER_LINE_TYPE = {
    DISCOUNT: 'discount',
    SHIPPING_FEE: 'shipping_fee',
    SALES_TAX: 'sales_tax',
    PHYSICAL: 'physical',
    SURCHARGE: 'surcharge',
    GIFT_CERTIFICATE: 'gift_card',
    GIFT_CERTIFICATE_PI: 'store_credit'
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
    NOTIFICATION: 'KlarnaPayments-Notification',
    MINISUMMARY_UPDATE: 'COBilling-UpdateSummary',
    BANK_TRANSFER_CALLBACK: 'KlarnaPayments-BankTransferCallback',
    BANK_TRANSFER_AWAIT_CALLBACK: 'KlarnaPayments-BankTransferAwaitCallback',
    FAIL_ORDER: 'KlarnaPayments-FailOrder',
    WRITE_ADDITIONAL_LOG: 'KlarnaPayments-WriteLog',
    HANDLE_EXPRESS_CHECKOUT_AUTH: 'KlarnaPayments-HandleAuthorizationResult',
    EXPRESS_CHECKOUT_AUTH_CALLBACK: 'KlarnaPayments-ECAuthorizationCallback',
    GENERATE_EXPRESS_CHECKOUT_PAYLOAD: 'KlarnaPayments-GenerateExpressCheckoutPayload',
    HANDLE_AUTH_FAILURE_PDP: 'KlarnaPayments-HandleAuthFailure',
    KLARNA_SIGNIN_CHECKOUT_REDIRECTURL_SFRA: 'Checkout-Begin',
    KLARNA_SIGNIN_CHECKOUT_REDIRECTURL_SG: 'COCustomer-Start'
};

var KLARNA_JS_CONSTANTS = {
    ERROR_MSG_ALERT_TIMEOUT: 2000,
    KEC_ERROR_WAITTIME: 100,
    FORM_VALIDATION_NUM_RETRIES: 3
};

var KLARNA_LIBS_URLS = {
    EXPRESS_CHECKOUT_URL: 'https://x.klarnacdn.net/kp/lib/v1/api.js',
    KLARNA_SIGNIN_SCRIPT_URL: 'https://js.klarna.com/web-sdk/v1/klarna.js',
    KLARNA_OSM_SCRIPT_URL: 'https://js.klarna.com/web-sdk/v1/klarna.js'
}

var KLARNA_ENVIRONMENTS = {
    PLAYGROUND: 'playground',
    PRODUCTION: 'production'
}

var KLARNA_ENDPOINTS = {
    EU: {
        "playground": "https://api.playground.klarna.com/",
        "production": "https://api.klarna.com/"
    },
    NA: {
        "playground": "https://api-na.playground.klarna.com/",
        "production": "https://api-na.klarna.com/"
    },
    OC: {
        "playground": "https://api-oc.playground.klarna.com/",
        "production": "https://api-oc.klarna.com/"
    },
    LOGIN: {
        "playground": "https://login.playground.klarna.com/",
        "production": "https://login.klarna.com/"
    }
}

var KLARNA_EXPRESS_CATEGORY_CONTENT = {
    KEC_CONTENT: [
        {
            "asset_urls": {
                "descriptive": "https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg",
                "standard": "https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg"
            },
            "identifier": "klarna",
            "name": dw.web.Resource.msg('klarna.payment.method', 'klarnapayments', null)
        }
    ]
}

var SIGN_IN_DEFAULT_SCOPE = 'openid offline_access payment:request:create ';

var SERVICE_HEADER = 'SFCC SG Version: ' + dw.web.Resource.msg('revisioninfo.revisionnumber', 'revisioninfo', 'Not found') + ' | Klarna Payments 24.5.0';

module.exports.FRAUD_STATUS = FRAUD_STATUS;
module.exports.PAYMENT_METHOD = PAYMENT_METHOD;
module.exports.ORDER_LINE_TYPE = ORDER_LINE_TYPE;
module.exports.CONTENT_TYPE = CONTENT_TYPE;
module.exports.FRAUD_STATUS_MAP = FRAUD_STATUS_MAP;
module.exports.SHIPPING_METHOD_TYPE = SHIPPING_METHOD_TYPE;
module.exports.SHIPPING_TYPE = SHIPPING_TYPE;
module.exports.KLARNA_PAYMENT_URLS = KLARNA_PAYMENT_URLS;
module.exports.SERVICE_HEADER = SERVICE_HEADER;
module.exports.KLARNA_JS_CONSTANTS = KLARNA_JS_CONSTANTS;
module.exports.KLARNA_LIBS_URLS = KLARNA_LIBS_URLS;
module.exports.KLARNA_EXPRESS_CATEGORY_CONTENT = KLARNA_EXPRESS_CATEGORY_CONTENT;
module.exports.KLARNA_ENVIRONMENTS = KLARNA_ENVIRONMENTS;
module.exports.KLARNA_ENDPOINTS = KLARNA_ENDPOINTS;
module.exports.KLARNA_SERVICE = KLARNA_SERVICE;
module.exports.SIGN_IN_DEFAULT_SCOPE = SIGN_IN_DEFAULT_SCOPE;