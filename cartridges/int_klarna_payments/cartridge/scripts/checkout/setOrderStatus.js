/**
* Script to update order status and order export status
*
* @module cartridge/scripts/checkout/setOrderStatus
* 
* @input Order : dw.order.Order The SFCC Order object
*/
var Order = require( 'dw/order/Order' );

/**
 * Function that can be called by pipelines
 * 
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var order = args.Order;
    if ( empty( order ) ) {
        dw.system.Logger.error( 'Failed to update order status because order is missing' );
        return PIPELET_ERROR;
    }
    updateOrderStatus( order );
    return PIPELET_NEXT;
}

/**
 * Function that will update the order export status and confirmation status
 * 
 * @param {dw.order.Order} order SFCC order to be updated
 * @return {void}
 */
function updateOrderStatus( order ) {
    // set the export status to EXPORT_STATUS_READY
    order.setExportStatus( Order.EXPORT_STATUS_READY );
    // set the confirmation status to confirmed
    order.setConfirmationStatus( Order.CONFIRMATION_STATUS_CONFIRMED );
}

module.exports = {
    updateOrderStatus: updateOrderStatus
};