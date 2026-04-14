'use strict';

var superMdl = module.superModule;
var Resource = require('dw/web/Resource');

var NOTIFY_EVENT_TYPES = {
    FRAUD_RISK_ACCEPTED: 'FRAUD_RISK_ACCEPTED'
};

var CREDIT_CARD_PROCESSOR_ID = 'basic_credit';

var PAYMENT_METHOD = 'KLARNA_PAYMENTS';

var KLARNA_PAYMENT_URLS = {
    CREATE_SESSION: '',
    UPDATE_SESSION: 'KlarnaPayments-RefreshSession',
    CLEAR_SESSION: '',
    SAVE_AUTH: 'KlarnaPayments-SaveAuth',
    LOAD_AUTH: 'KlarnaPayments-LoadAuth',
    SELECT_PAYMENT_METHOD: 'KlarnaPayments-SelectPaymentMethod',
    CONFIRMATION: 'KlarnaPayments-ShowConfirmation',
    NOTIFICATION: 'KlarnaPayments-Notification',
    MINISUMMARY_UPDATE: '',
    BANK_TRANSFER_CALLBACK: 'KlarnaPayments-BankTransferCallback',
    BANK_TRANSFER_AWAIT_CALLBACK: 'KlarnaPayments-BankTransferAwaitCallback',
    FAIL_ORDER: 'KlarnaPayments-FailOrder',
    WRITE_ADDITIONAL_LOG: 'KlarnaPayments-WriteLog',
    HANDLE_EXPRESS_CHECKOUT_AUTH: 'KlarnaPayments-HandleAuthorizationResult',
    EXPRESS_CHECKOUT_AUTH_CALLBACK: 'KlarnaPayments-ECAuthorizationCallback',
    GENERATE_EXPRESS_CHECKOUT_PAYLOAD: 'KlarnaPayments-GenerateExpressCheckoutPayload',
    HANDLE_AUTH_FAILURE_PDP: 'KlarnaPayments-HandleAuthFailure',
    KLARNA_SIGNIN_CHECKOUT_REDIRECTURL_SFRA: 'Checkout-Begin',
    KLARNA_SIGNIN_CHECKOUT_REDIRECTURL_SG: 'COCustomer-Start',
    SAVE_INTEROPERABILITY_TOKEN: 'KlarnaPayments-SaveInteroperabilityToken',
    SINGLE_STEP_CHECKOUT: 'KlarnaPayments-SingleStepCheckout',
    SHIPPING_ADDRESS_CHANGE: 'KlarnaPayments-ShippingAddressChange',
    SHIPPING_OPTION_SELECT: 'KlarnaPayments-ShippingOptionSelect'
};

var SERVICE_HEADER = 'SFCC SFRA Version: ' + Resource.msg('global.version.number', 'version', 'Not found') + ' | Klarna Payments 26.1.1';

superMdl.PAYMENT_METHOD = PAYMENT_METHOD;
superMdl.KLARNA_PAYMENT_URLS = KLARNA_PAYMENT_URLS;
superMdl.SERVICE_HEADER = SERVICE_HEADER;
superMdl.KLARNA_LIBS_URLS.KLARNA_OSM_SCRIPT_URL = 'https://js.klarna.com/web-sdk/v2/klarna.mjs';
superMdl.integrator = {
    name: 'KLARNA_SFCC_CARTRIDGE',
    moduleName: 'KLARNA_SFCC_CARTRIDGE',
    moduleVersion: Resource.msg('release.version', 'release', 'Not found')
};
superMdl.originators = [{
    name: 'SALESFORCE_COMMERCE_CLOUD',
    module_name: 'KLARNA_SFCC_CARTRIDGE',
    module_version: Resource.msg('release.version', 'release', 'Not found')
}];

module.exports = superMdl;

module.exports.NOTIFY_EVENT_TYPES = NOTIFY_EVENT_TYPES;
module.exports.CREDIT_CARD_PROCESSOR_ID = CREDIT_CARD_PROCESSOR_ID;
