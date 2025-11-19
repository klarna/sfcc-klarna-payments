/**
* Script to get Klarna Payments order
*
* @module cartridge/scripts/order/klarnaPaymentsGetOrder
* 
* @input OrderID : String The Klarna Payments Order Number
* @input LocaleObject : Object
*
* @output klarnaOrder : Object
*/

'use strict';

var StringUtils = require( 'dw/util/StringUtils' );

var logger = dw.system.Logger.getLogger( 'klarnaPaymentsGetOrder.js' );
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
function execute( args ) {
    var klarnaPaymentsOrderID = args.OrderID;
    var localeObject = args.LocaleObject;
    var klarnaOrder = getKlarnaOrder( klarnaPaymentsOrderID, localeObject );

    args.klarnaOrder = klarnaOrder;

    return PIPELET_NEXT;
}

/**
 * Call Klarna Payments API to get an order
 * @param {string} klarnaPaymentsOrderID Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object} Klarna order
 */
function getKlarnaOrder( klarnaPaymentsOrderID , localeObject ) {
    var klarnaHttpService = {};
    var klarnaApiContext = {};
    var klarnaOrderID = klarnaPaymentsOrderID;
    var requestUrl = '';
    var serviceID = '';

    try {
        klarnaHttpService = new KlarnaPayments.httpService();
        klarnaApiContext = new KlarnaPayments.apiContext();
        requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'getOrder' ), klarnaOrderID );
        serviceID = klarnaApiContext.getFlowApiIds().get( 'getOrder' );
        return klarnaHttpService.call( serviceID, requestUrl, 'GET', localeObject.custom.credentialID );
    } catch( e ) {
        logger.error( 'Error while retrieving order: {0}', e );
    }

    return null;
}

module.exports = {
    getKlarnaOrder: getKlarnaOrder
};