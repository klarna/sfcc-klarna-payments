/* globals empty */

'use strict';

var Builder = require( '*/cartridge/scripts/payments/builder' );
var strval = require( '*/cartridge/scripts/util/klarnaHelper' ).strval;

var CONTENT_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).CONTENT_TYPE;
var SHIPPING_METHOD_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).SHIPPING_METHOD_TYPE;
var SHIPPING_TYPE = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).SHIPPING_TYPE;

var OrderMgr = require( 'dw/order/OrderMgr' );
var Order = require( 'dw/order/Order' );
var Logger = require( 'dw/system/Logger' ).getLogger( 'KlarnaPayments' );

/**
 * KP Order Line Item Builder
 * @returns {void}
 */
function AdditionalCustomerInfo() {
    this.item = null;
}

AdditionalCustomerInfo.prototype = new Builder();

/**
 * Function to get customers payment history details
 *
 * @param {dw.customer.Customer} customer customer object
 * @returns {Array} Array containing customer payment history
 */
AdditionalCustomerInfo.prototype.buildAdditionalCustomerPaymentHistory = function( customer ) {
    var paymentHistoryFull = [{}];
    paymentHistoryFull[0].unique_account_identifier = customer.ID;
    paymentHistoryFull[0].payment_option = 'other';

    if ( customer.getActiveData() ) {
        paymentHistoryFull[0].number_paid_purchases = !empty( customer.activeData.orders ) ? customer.activeData.orders : 0;
        paymentHistoryFull[0].total_amount_paid_purchases = !empty( customer.activeData.orderValue ) ? customer.activeData.orderValue : 0;

        if ( !empty( customer.activeData.lastOrderDate ) ) {
            paymentHistoryFull[0].date_of_last_paid_purchase = customer.activeData.lastOrderDate.toISOString().slice( 0, -5 ) + 'Z';
        }
    }

    try {
        if ( customer && customer.profile ) {
            var searchOrderQuery = 'customerNo = {0} AND custom.klarna_oms__kpOrderID != {1} AND (status = {2} or status = {3}) AND confirmationStatus = {4}';
            var order = OrderMgr.searchOrders( searchOrderQuery, 'creationDate', customer.profile.customerNo, null, Order.ORDER_STATUS_NEW, Order.ORDER_STATUS_OPEN, Order.CONFIRMATION_STATUS_CONFIRMED ).first();
            if ( order ) {
                paymentHistoryFull[0].date_of_first_paid_purchase = order.creationDate.toISOString().slice( 0, -5 ) + 'Z';
            }
        }
    } catch ( e ) {
        Logger.error( e );
    }

    return paymentHistoryFull;
};

/**
 * Function to get customer information
 *
 * @param {dw.order.Basket} basket basket object
 * @return {string} json containing customer information
 */
AdditionalCustomerInfo.prototype.buildAdditionalCustomerInfoBody = function( basket ) {
    var customer = basket.getCustomer();
    var body = {};

    body.customer_account_info = new Array( {} );

    if ( customer.registered ) {
        body.customer_account_info[0].unique_account_identifier = customer.profile.customerNo;
        body.customer_account_info[0].account_registration_date = !empty( customer.profile.creationDate ) ? customer.profile.creationDate.toISOString().slice( 0, -5 ) + 'Z' : '';
        body.customer_account_info[0].account_last_modified = !empty( customer.profile.lastModified ) ? customer.profile.lastModified.toISOString().slice( 0, -5 ) + 'Z' : '';
    }

    body.payment_history_full = this.buildAdditionalCustomerPaymentHistory( customer );
    body.other_delivery_address = this.buildOtherDeliveryAddresses( basket );

    return JSON.stringify( body );
};

/**
 * Function to get delivery address details
 *
 * @param {dw.order.Basket} basket basket object
 * @return {dw.util.Collection} Array containing delivery address details
 */
AdditionalCustomerInfo.prototype.buildOtherDeliveryAddresses = function( basket ) {
    var otherAddresses = [];
    var shipments = basket.shipments;
    var billingAddress = basket.billingAddress;

    for ( var i = 0; i < shipments.length; i++ ) {
        var shipment = shipments[i];
        var shippingAddress = shipment.shippingAddress;

        // Use "fromStoreId" as "shipmentType = instore" is not always available
        // Send billing names in the address info
        if ( !empty( shipment.custom.fromStoreId ) && !empty( shippingAddress ) && shipment.productLineItems.length > 0 ) {
            otherAddresses.push( {
                shipping_method: SHIPPING_METHOD_TYPE.STORE,
                shipping_type: SHIPPING_TYPE.NORMAL,
                first_name: !empty( billingAddress ) ? strval( billingAddress.firstName ) : '',
                last_name: !empty( billingAddress ) ? strval( billingAddress.lastName ) : '',
                street_address: strval( shippingAddress.address1 ),
                street_number: strval( shippingAddress.address2 ),
                postal_code: strval( shippingAddress.postalCode ),
                city: strval( shippingAddress.city ),
                country: strval( shippingAddress.countryCode.value )
            } );
        }
    }

    return otherAddresses;
};

/**
 * @param {dw.order.Basket} basket Customer's basket
 * @return {dw.order.LineItem} Sales tax line item
 */
AdditionalCustomerInfo.prototype.build = function( basket ) {
    this.item = {};
    this.item.content_type = CONTENT_TYPE;
    this.item.body = this.buildAdditionalCustomerInfoBody( basket );

    return this.item;
};

module.exports = AdditionalCustomerInfo;
