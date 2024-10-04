/**
* API call to create new Klarna Payments VCN settlement. If the settlement 
* retry has been enabled, we will retry to settle the order in case the first one failed
*
* @module cartridge/scripts/VCN/klarnaPaymentsVCNSettlement
* 
* @input Order : dw.order.Order The SCC Order object
* @input klarnaPaymentsOrderID : String
* @input LocaleObject : Object
*/

'use strict';

var Site = require( 'dw/system/Site' );
var Logger = require( 'dw/system/Logger' );
var KlarnaHelper = require('*/cartridge/scripts/util/klarnaHelper');

/* Script Modules */
var log = Logger.getLogger( 'klarnaPaymentsVCNSettlement.js' );

var KlarnaPayments = {
    httpService    : require( '*/cartridge/scripts/common/klarnaPaymentsHttpService' ),
    apiContext     : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var localeObject = args.LocaleObject;
    var klarnaPaymentsOrderID = args.klarnaPaymentsOrderID;
    var order = args.Order;

    var result = handleVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
    if ( !result ) {
        return PIPELET_ERROR;
    }

    return PIPELET_NEXT;
}

/**
 * Function to handle VCN settlement. If result is empty, the VCN settlement
 * will be attempted as many times as set in the custom preference
 *
 * @param {dw.order.Order} order SFCC order object
 * @param {string} klarnaPaymentsOrderID order ID
 * @param {Object} localeObject Klarna locale object
 * @return {boolean} VCN Settlement status
 */
function handleVCNSettlement( order, klarnaPaymentsOrderID, localeObject ) {
    var settlementRetry = KlarnaHelper.isVCNSettlementRetry();

    if ( settlementRetry ) {
        var retryCount = 1;
        var result = false;
        var i = 0;

        while ( i <= retryCount && !result ) {
            result = createVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
            i++;
        }

        return result;
    }

    return createVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
}

/**
 * Function to attempt the VCN settlement
 *
 * @param {dw.order.Order} order SFCC order object 
 * @param {string} klarnaPaymentsOrderID orderID
 * @param {Object} localeObject Klarna locale object
 * @return {boolean} VCN settlement status
 */
function createVCNSettlement( order, klarnaPaymentsOrderID, localeObject ) {
    var klarnaPaymentsHttpService = {};
    var klarnaApiContext = {};
    var requestBody = {};
    var requestUrl = '';
    var response = {};

    try {
        klarnaPaymentsHttpService = new KlarnaPayments.httpService();
        klarnaApiContext = new KlarnaPayments.apiContext();
        requestUrl = klarnaApiContext.getFlowApiUrls().get( 'vcnSettlement' );
        var serviceID = klarnaApiContext.getFlowApiIds().get( 'vcnSettlement' );
        requestBody = {
            'order_id' : klarnaPaymentsOrderID,
            'key_id' : KlarnaHelper.getVCNKeyId()
        };

        response = klarnaPaymentsHttpService.call( serviceID, requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
        if( empty( response.settlement_id ) || empty( response.cards ) ) {
            log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
            return false;
        }
        var Transaction = require( 'dw/system/Transaction' );
        Transaction.wrap( function() {
            order.custom.kpVCNBrand = response.cards[0].brand;
            order.custom.kpVCNHolder = response.cards[0].holder;
            order.custom.kpVCNCardID = response.cards[0].card_id;
            order.custom.kpVCNPCIData = response.cards[0].pci_data;
            order.custom.kpVCNIV = response.cards[0].iv;
            order.custom.kpVCNAESKey = response.cards[0].aes_key;
            order.custom.kpIsVCN = true;
        } );
    } catch ( e ) {
        log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );

        var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );
        KlarnaAdditionalLogging.writeLog(order, order.custom.kpSessionId, 'klarnaPaymentsVCNSettlement.createVCNSettlement()', 'Error in creating Klarna Payments VCN Settlement. Error:' + JSON.stringify( e ) );

        return false;
    }

    return true;
}

module.exports = {
    handleVCNSettlement: handleVCNSettlement
};
