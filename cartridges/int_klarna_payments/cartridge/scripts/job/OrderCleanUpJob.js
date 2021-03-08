'use strict';

/**
 * Script to process VCN orders with status 'Exported' and remove sensitive card details from server
 */

/* API Includes */
var Status = require( 'dw/system/Status' );
var Logger = require( 'dw/system/Logger' );
var Transaction = require( 'dw/system/Transaction' );

/**
 * Function called by job to clear sensitive Klarna payments details
 * @param {Object} parameters Job parameters
 * @return {dw.system.Status} execution status
 */
exports.execute = function( parameters ) {
    var ordersIterator = null;
    try {
        var siteID = dw.system.Site.getCurrent().getID();
        ordersIterator = dw.object.SystemObjectMgr.querySystemObjects( 'Order', 'exportStatus = {0} AND custom.kpIsVCN = {1} ' +
                'AND custom.kpVCNPAN != NULL', 'creationDate asc', dw.order.Order.EXPORT_STATUS_EXPORTED, true );

        if ( ordersIterator.getCount() > 0 ) {
            Transaction.begin();
            while ( ordersIterator.hasNext() ) {
                var order = ordersIterator.next();
                order.custom.kpVCNPAN = null;
                order.custom.kpVCNCSC = null;
                order.custom.kpVCNExpirationMonth = null;
                order.custom.kpVCNExpirationYear = null;
            }
            Transaction.commit();
            Logger.debug( '[' + siteID + '] Orders processed: ' + ordersIterator.getCount() );
        } else {
            Logger.debug( '[' + siteID + '] No orders require processing' );
        }
    } catch ( e ) {
        Logger.error( 'Error: {0}', e.message + e.stack );
        return new Status( Status.ERROR );
    } finally {
        if ( ordersIterator ) {
            try {
                ordersIterator.close();
            } catch ( e ) {
                Logger.error( 'Failed to close seekable iterator.' );
            }
        }
    }

    return new Status( Status.OK );
};