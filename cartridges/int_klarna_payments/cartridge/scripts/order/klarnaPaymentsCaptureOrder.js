/**
 * API call to capture the order
 *
 * @input KlarnaOrderID : String
 * @input LocaleObject : Object
 * @input Order : dw.order.Order
 *
 */

var Logger = require( 'dw/system/Logger' );
var logger = Logger.getLogger( 'KlarnaPaymentsCaptureOrder.js' );
var KlarnaPayments = {
    httpService: require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext: require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};
var KlarnaPaymentsConstants = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' );
var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;

/**
 * Attempts to create a full-amount capture through Klarna API.
 * @param {string} klarnaOrderID KP Order ID
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries.
 * @param {Object} captureData capture data.
 * @returns {void}
 */
function _createCapture( klarnaOrderID, localeObject, captureData ) {
    var StringUtils = require( 'dw/util/StringUtils' );

    var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
    var klarnaApiContext = new KlarnaPayments.apiContext();
    var requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createCapture' ), klarnaOrderID );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'createCapture' );
    var requestBody = {
        captured_amount: captureData.amount
    };

    klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
}

/**
 * Find the first klarna payment transaction within the order (if exists).
 *
 * @param {dw.order.Order} order - The Order currently being placed.
 * @returns {dw.order.PaymentTransaction} Klarna Payment Transaction
 */
function findKlarnaPaymentTransaction( order ) {
    var paymentTransaction = null;
    var paymentInstruments = order.getPaymentInstruments( PAYMENT_METHOD );

    if ( !empty( paymentInstruments ) && paymentInstruments.length ) {
        paymentTransaction = paymentInstruments[0].paymentTransaction;
    }

    return paymentTransaction;
}

/**
 * Returns full order amount for a SFCC order.
 *
 * @param {dw.order.Order} dwOrder SFCC Order object.
 * @return {dw.value.Money} payment transaction amount.
 */
function getPaymentInstrumentAmount( dwOrder ) {
    var kpTransaction = findKlarnaPaymentTransaction( dwOrder );

    var transactionAmount = kpTransaction.getAmount();

    return transactionAmount;
}

/**
 * Handle auto-capture functionality.
 *
 * @param {dw.order.Order} dwOrder SFCC Order object.
 * @param {string} kpOrderId Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject locale object (KlarnaCountries).
 * @returns {void}
 */
function handleAutoCapture( dwOrder, kpOrderId, localeObject ) {
    var captureData = {
        amount: Math.round( getPaymentInstrumentAmount( dwOrder ).getValue() * 100 )
    };

    try {
        _createCapture( kpOrderId, localeObject, captureData );
        dwOrder.setPaymentStatus( dwOrder.PAYMENT_STATUS_PAID );
    } catch ( e ) {
        logger.error( 'Error in creating Klarna Payments Order Capture: {0}', e.message + e.stack );

        throw e;
    }
}

/**
 * Function that can be called by pipelines
 * 
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args )
{
    var localeObject = args.LocaleObject;
    var klarnaOrderID = args.KlarnaOrderID;
    var order = args.Order;

    try {
        handleAutoCapture( order, klarnaOrderID, localeObject );
    } catch ( e ) {
        logger.error( e );
        return PIPELET_ERROR;
    }

    return PIPELET_NEXT;
}

module.exports = {
    handleAutoCapture: handleAutoCapture
};