'use strict';

/* API Includes */
const PaymentMgr = require( 'dw/order/PaymentMgr' );
const Transaction = require( 'dw/system/Transaction' );
const Logger = require( 'dw/system/Logger' );

/* Script Modules */
const log = Logger.getLogger( 'Klarna.js' );
let klarnaRemovePreviousPI = require( 'int_klarna/cartridge/scripts/klarnaRemovePreviousPI' );
let klarnaPaymentInstrument = require( 'int_klarna/cartridge/scripts/createKlarnaPaymentInstrument' );

/**
 * Creates a Klarna payment instrument for the given basket
 */
function handle( args )
{
	let result;
	
    Transaction.wrap( function () {
    	result = klarnaRemovePreviousPI.removePaymentInstruments( args.Basket );
        if( result === PIPELET_ERROR )
        {
    		return {error : true};
    	}
        // payment instrument returned on success
        result = klarnaPaymentInstrument.create( args.Basket );
    } );
    
    if( result === PIPELET_ERROR )
    {
		return {error : true};
	}

	return {success : true};
}

/**
 * Authorizes a payment using a credit card. 
 * The payment is authorized by using the BASIC_CREDIT processor only and setting the Klarna order ID as the transaction ID. 
 * Customizations may use other processors and custom logic to authorize credit card payment.
 */
function authorize( args )
{ 
    var orderNo = args.OrderNo;
    var paymentInstrument = args.PaymentInstrument;
    var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();

    Transaction.wrap( function () {
        paymentInstrument.paymentTransaction.transactionID = orderNo;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    });

    return {authorized: true};
}

exports.Handle = handle;
exports.Authorize = authorize;
