/**
* Script to update order, export and payment status when fraud status is 'Pending'
*
* @module cartridge/scripts/checkout/setPendingOrderStatus
*
* @input Order : dw.order.Order The SFCC Order object
*/
var Order = require( 'dw/order/Order' );

/**
 * Function that can be called by pipelines
 *
 * @param {Object} args Object parameters
 *
 * @return {number} status
 */
function execute( args )
{
    var order = args.Order;
    if ( empty( order ) ) {
        dw.system.Logger.error( 'Failed to update order status because order is missing' );
        return PIPELET_ERROR;
    }
    updatePendingOrderStatus( order );
    return PIPELET_NEXT;
}

/**
 * Function that will update the order export status, payment status and confirmation status
 *
 * @param {dw.order.Order} order SFCC order to be updated
 * @return {void}
 */
function updatePendingOrderStatus( order ) {
    // set the export status to EXPORT_STATUS_NOTEXPORTED
    order.setExportStatus( Order.EXPORT_STATUS_NOTEXPORTED );

    // set the confirmation status to not confirmed
    order.setConfirmationStatus( Order.CONFIRMATION_STATUS_NOTCONFIRMED );

    // set the payment status to NOT PAID
    order.setPaymentStatus( Order.PAYMENT_STATUS_NOTPAID );
}

module.exports = {
    updatePendingOrderStatus: updatePendingOrderStatus
};