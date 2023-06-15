/**
* Script to cancel an existing Klarna Payments order
*
* @module cartridge/scripts/order/klarnaPaymentsCancelOrder
*
* @input Order : dw.order.Order The SCC Order object
* @input LocaleObject : Object
*/

// import packages
var logger = dw.system.Logger.getLogger( 'KlarnaPaymentsCancelOrder.js' );
var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );
var KlarnaPayments = {
    httpService : require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};

/**
 * Function that can be called by pipelines
 * 
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args )
{
    var cancelOrderResult = cancelOrder( args.LocaleObject, args.Order )
    if ( !cancelOrderResult.success ) {
        return PIPELET_ERROR;
    }
    return PIPELET_NEXT;	
}

/**
 * Function to cancel Klarna Order
 * 
 * @param {Object} localeObject Klarna locale object
 * @param {dw.order.Order} order SFCC order object
 * @return {object} execution status
 */
function cancelOrder( localeObject, order ) {
    try {
        var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        var klarnaApiContext = new KlarnaPayments.apiContext();
        var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'cancelOrder' ), order.custom.klarna_oms__kpOrderID );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'cancelOrder' );
        klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, null );
    } catch ( e ) {
        logger.error( 'Error in cancelling Klarna Payments Order: {0}', e );
        KlarnaAdditionalLogging.writeLog( order, order.custom.kpSessionId, 'order/klarnaPaymentsCancelOrder.js:cancelOrder()', 'Error in cancelling Klarna Payments Order. Error:' + JSON.stringify( e ) );

        return {
            success: false
        };
    }
    return {
        success: true
    };
}

module.exports = {
    cancelOrder: cancelOrder
}