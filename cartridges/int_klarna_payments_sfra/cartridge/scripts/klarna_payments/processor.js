'use strict';

var KlarnaPaymentsConstants = require( '~/cartridge/scripts/util/KlarnaPaymentsConstants.js' );
var KlarnaOrderService = require( '~/cartridge/scripts/common/KlarnaOrderService' );

var PAYMENT_METHOD = KlarnaPaymentsConstants.PAYMENT_METHOD;
var CREDIT_CARD_PROCESSOR_ID = KlarnaPaymentsConstants.CREDIT_CARD_PROCESSOR_ID;
var FRAUD_STATUS = KlarnaPaymentsConstants.FRAUD_STATUS;

var Transaction = require( 'dw/system/Transaction' );
var PaymentMgr = require( 'dw/order/PaymentMgr' );
var OrderMgr = require( 'dw/order/OrderMgr' );
var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Countries = require( '~/cartridge/scripts/util/Countries' );
var Logger = require( 'dw/system/Logger' );
var StringUtils = require( 'dw/util/StringUtils' );
var Site = require( 'dw/system/Site' );
var Cypher = require( 'dw/crypto/Cipher' );
var Status = require( 'dw/system/Status' );
var Order = require( 'dw/order/Order' );

var log = Logger.getLogger( 'KLARNA_PAYMENTS.js' );

var KlarnaPayments = {
	httpService 			: require( '~/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( '~/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( '~/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( '~/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};

var collections = require( '*/cartridge/scripts/util/collections' );

/**
 * Calculates the amount to be payed by a non-gift certificate payment instrument based
 * on the given basket. The method subtracts the amount of all redeemed gift certificates
 * from the order total and returns this value.
 *
 * @param {Object} lineItemCtnr - LineIteam Container (Basket or Order)
 * @returns {dw.value.Money} non gift certificate amount
 */
function calculateNonGiftCertificateAmount( lineItemCtnr ) {
	var orderTotal = 0;
	var amountOpen = 0;
	var giftCertTotal = new dw.value.Money( 0.0, lineItemCtnr.currencyCode );
	var gcPaymentInstrs = lineItemCtnr.getGiftCertificatePaymentInstruments();
	var iter = gcPaymentInstrs.iterator();
	var orderPI = null;

	while ( iter.hasNext() ) {
		orderPI = iter.next();
		giftCertTotal = giftCertTotal.add( orderPI.getPaymentTransaction().getAmount() );
	}

	orderTotal = lineItemCtnr.totalGrossPrice;
	amountOpen = orderTotal.subtract( giftCertTotal );

	return amountOpen;
}

/*
function createPaymentInstrument( basket, paymentType ) {
	var paymentInstr = null;

	if ( basket === null ) {
		return null;
	}

	var iter = basket.getPaymentInstruments( paymentType ).iterator();
	Transaction.wrap( function() {
		while ( iter.hasNext() ) {
			var existingPI = iter.next();
			basket.removePaymentInstrument( existingPI );
		}
	} );

	var amount = calculateNonGiftCertificateAmount( basket );

	Transaction.wrap( function() {
		paymentInstr = basket.createPaymentInstrument( paymentType, amount );
	} );

	return paymentInstr;
}
*/

/**
 * Creates a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if order has been successfully created, otherwise false
 */
function _createOrder( order, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;

	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getOrderRequestBody( order, localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createOrder' ), klarnaAuthorizationToken );

		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );

		Transaction.wrap( function() {
			session.privacy.KlarnaPaymentsSessionID = null; // dettach klarna session handler id from user session
			session.privacy.KlarnaPaymentsOrderID = response.order_id;
			session.privacy.KlarnaPaymentsRedirectURL = response.redirect_url;
			session.privacy.KlarnaPaymentsFraudStatus = response.fraud_status;
		} );
	} catch( e ) {
		log.error( 'Error in creating Klarna Payments Order: {0}', e );
		return false;
	}

	return true;
}

/**
 * Call Klarna Payments API to acknowledge the order
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {void}
 */
function _acknowledgeOrder( klarnaPaymentsOrderID, localeObject )
{
	var klarnaHttpService = {};
	var klarnaApiContext = {};
	var klarnaOrderID = klarnaPaymentsOrderID; 
	var requestUrl = '';
	var response = {};

	try {
		klarnaHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'acknowledgeOrder' ), klarnaOrderID );

		response = klarnaHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID );
	} catch( e ) {
		log.error( 'Error in acknowlidging order: {0}', e );
	}
}

/**
 * Cancels a Klarna order through Klarna API
 * @param {dw.order.Order} order SCC order object
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if order has been successfully cancelled, otherwise false
 */
function _cancelOrder( order, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestUrl = '';
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'cancelOrder' ), order.custom.kpOrderID );

		klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, null );
	} catch( e ) 
	{
		log.error( 'Error in cancelling Klarna Payments Order: {0}', e );
		return false;
	}  
	return true;
}

/**
 * Gets Klarna Payments Locale object
 * 
 * @param {string} currentCountry current country locale
 * 
 * @return {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 */
function getLocale( currentCountry ) {
	var localeObject = {};
	var countryCode = '';
	var currCountry = currentCountry;

	if ( empty( currentCountry ) ) {
		currCountry = Countries.getCurrent( {CurrentRequest: request} ).countryCode;
	}

	localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', currCountry );

	return localeObject;
}

/**
 * Creates a Klarna payments order through Klarna API
 * @param {dw.order.Order} 			order 			SCC order object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
function _getOrderRequestBody( order, localeObject )
{
	var orderRequestBuilder = new KlarnaPayments.orderRequestBuilder();
	
	return orderRequestBuilder.buildRequest( {
		order: order,
		localeObject: localeObject
	} ).get();
}

/**
 * Place an order using OrderMgr. If order is placed successfully,
 * its status will be set as confirmed, and export status set to ready. Acknowledge order with Klarna Payments
 * 
 * @param {dw.order.Order} 			order 					SCC order object
 * @param {string} 					klarnaPaymentsOrderID 	Klarna Payments Order ID
 * @param {dw.object.CustomObject} 	localeObject 			Klarna Payments locale Object
 * 
 * @return {void}
 */
function placeOrder( order, klarnaPaymentsOrderID, localeObject ) {
	Transaction.wrap( function() {
		var placeOrderStatus = OrderMgr.placeOrder( order );
		if ( placeOrderStatus === Status.ERROR ) {
			OrderMgr.failOrder( order );
			throw new Error( 'Failed to place order.' );
		}
		order.setConfirmationStatus( order.CONFIRMATION_STATUS_CONFIRMED );
		order.setExportStatus( order.EXPORT_STATUS_READY );
	} );

	_acknowledgeOrder( klarnaPaymentsOrderID, localeObject );
}

/**
 * Create VCN settlement
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments order id
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @return {Boolean} true if VCN settlement is created successfully, otherwise false 
 */
function _createVCNSettlement( order, klarnaPaymentsOrderID, localeObject )
{
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	var VCNPrivateKey = Site.getCurrent().getCustomPreferenceValue( 'vcnPrivateKey' );
	var cypher = new Cypher();
	var panEncrypted = "";
	var cscEncrypted = "";
	var panDecrypted = "";
	var cscDecrypted = "";


	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = {'order_id' : klarnaPaymentsOrderID};
		requestUrl = klarnaApiContext.getFlowApiUrls().get( 'vcnSettlement' );

		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );	
		if ( empty( response.settlement_id ) ) {
			log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
			return false;		
		}

		//	var panEncrypted = response.cards[0].pan;
		//	var cscEncrypted = response.cards[0].csc;

		//mocking pan and csc
		panEncrypted = 'U50dpsYfr29a+kZta2A9pYdAPYvp1GnUYEt7BwFF2vWcD+31EHhzUuKHNnns61NQ+pjayXjHMll1v3lNLDehhAVj5/OuJCmAgk20Wx1SI/RYLtK5wA9Iv7ZOnGdwXOseTTUcXCgY1fjpBWtpqlgsBgqobZhaX3Q0KaBk89qwT2o21/Yo5HKiafxnZSAQ0x2lG5GBkRjy/UC/9nfkeCNZATxADQG2L3FnHrqXq/F6CLUmsxPIawWO5wmpYToa4/4UhAuQS/L/3lmvXoBd68gNSQsWSs+gjrNxMejmR5HJvzuwUj+htLZxvGds+FRSFFABZfbU+z1b9HjbzdxdkD55jtVHoWA1diTiFODSguScertk0oCwAFz6AKFC4P7NedfDuko3QFew2ab3CFO76DYQYXDE18itNHAG/PgpkYttS7sS1n1EJMBGh+18BbOmOutyuuAq0z7j3tiUfLl0aXCMs76VeoawGBKQhIY2k6fUTlaRjolSAwcwZbZV7dZZq5TcwIVzhiIBOtz/v3y0AhnEUua5kOeM6r1ulPqdPv2vHRIPPDHwQ6051GB68QpVnIRnvR63UVOqogsXyBduO281MNbXWRlO7c1UbjI3UlJiM0AVsZgZ0uWQxhbF+Xu48dkjhcjvbA4oi79RRtw4UfDHyEOOSX2zaOf/D5KY1GUPwAw=';
		cscEncrypted = 'P/jEMDJszBNpVdwNN/OCBHW+yuF3WcXGhX/vwVFjeGjp/YohO//6pHm9ggtY0m6inTzvfA849VZlJxeq8QVpo1p8dUUvC6L6CvmUEC8kUZBU77TkNChJCvzaGYr74pjsntu65A3nipraGCoCkAdYagtrJBZ0gl6jrv8jq2f+OfuH+YZoX0HMqvSh0v1+M+7sHLhxVDPs7Daqn8v6qyuZEajMYk4AZI4uKAu/X3TJTItC4hXa/epGIPDivyQ/EwDMK27P/I8rfw0bY6zxMw2+fYWlVjXbrUtl7Z/WiiUNC3cayrZtysAphD3RLt9re6dC6h1AzCIWBFZxHKCJB1MihDqgALOeLS6B4rxqljbb3bfWAkK6nkbnSEHwlvh628eNyIS9Ga/YWlriy4Z7kcCH7VuFcfKskGiDUE1qozeOmq58dMj6DRwsjgCshnWfd/HXcIdYuvEb0wn/mMygZa7MG2V7Sd2ROLtNpn6JhR0WScgJcwNWVN7sfhmElGy8bcmDYArusU0mDTUfamPmhVeRTbdiWE8xEqSqmIStUoPe1BvxHeKs+Gdw6iQKsxruwOJb+Tz5zzyfbsrVDp3wxsa3nb9nSJOZGTmi3ie7y02a/KuLGsypsIXZR2P1Jjofuh4mvT1nu4W2VJKNG9IuhxIAh8adCCxbZ0Cn70+8P3p42S4=';

		panDecrypted = cypher.decrypt( panEncrypted, VCNPrivateKey, "RSA/ECB/PKCS1PADDING", null, 0 );
		cscDecrypted = cypher.decrypt( cscEncrypted, VCNPrivateKey, "RSA/ECB/PKCS1PADDING", null, 0 );

		Transaction.wrap( function() {
			order.custom.kpVCNBrand = response.cards[0].brand;
			order.custom.kpVCNCSC = cscDecrypted;
			order.custom.kpVCNExpirationMonth = response.cards[0].expiration_month;
			order.custom.kpVCNExpirationYear = response.cards[0].expiration_year;
			order.custom.kpVCNHolder = response.cards[0].holder;
			order.custom.kpVCNPAN = panDecrypted;
			order.custom.kpIsVCN = true;
		} );
	} catch ( e ) {
		log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
		return false;
	}

	return true;
}

function callCreditCardAuthorizationHook( order ) {
	var processorResult = null;
	var paymentInstrument = order.getPaymentInstruments( PAYMENT_METHOD )[0];
	var paymentProcessor = PaymentMgr
		.getPaymentMethod( paymentInstrument.paymentMethod )
		.paymentProcessor;

	var hook = 'app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID;
	if ( !HookMgr.hasHook( hook ) ) {
		throw new Error( 'File of app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID + ' hook is missing or the hook is not configured' );
	}

	processorResult = HookMgr.callHook( 'app.payment.processor.' + CREDIT_CARD_PROCESSOR_ID, 'Authorize', order.getOrderNo(), paymentInstrument, paymentProcessor );
	return processorResult;
}

function failOrder( order ) {
	Transaction.wrap( function() {
		OrderMgr.failOrder( order );
	} );
}

/**
 * Handles fraud risk stopped orders.
 *
 * @param {string} orderNo the SFCC order number
 * @return {void}
 */
function handleStoppedOrder( orderNo ) {
	var order = OrderMgr.getOrder( orderNo );

	if ( order ) {
		_handleStoppedOrder( order );
	}
}

function _handleStoppedOrder( order ) {
	Transaction.wrap( function() {
		var paymentInstrument = order.getPaymentInstruments( PAYMENT_METHOD )[0];
		if ( paymentInstrument ) {
			paymentInstrument.paymentTransaction.custom.kcFraudStatus = FRAUD_STATUS.STOPPED;
		}

		order.addNote( 'Klarna Payment Notification', 'FRAUD_RISK_STOPPED - The order was stopped for some reason' );
	} );

	if ( order.status.value === Order.ORDER_STATUS_CREATED ) {
		failOrder( order );
		return;
	}

	if ( order.confirmationStatus.value === Order.CONFIRMATION_STATUS_CONFIRMED && order.exportStatus.value === Order.EXPORT_STATUS_READY && order.paymentStatus.value === Order.PAYMENT_STATUS_NOTPAID ) {
		Transaction.wrap( function() {
			OrderMgr.cancelOrder( order );
			order.setCancelDescription( 'The order was stopped by Klarna for some reason.' );
			order.setExportStatus( Order.EXPORT_STATUS_NOTEXPORTED );
		} );
	} else if ( order.confirmationStatus.value === Order.CONFIRMATION_STATUS_CONFIRMED && ( order.exportStatus.value === Order.EXPORT_STATUS_EXPORTED || order.paymentStatus.value === Order.PAYMENT_STATUS_PAID ) ) {
		Logger.getLogger( 'Klarna' ).fatal( 'Klarna payment notification for order {0}: FRAUD_RISK_STOPPED - The order was stopped for some reason', orderNo );
	}
}

/**
 * Processor Handle
 *
 * @param {dw.order.LineItemCtnr} basket - Current basket
 * @param {boolean} isFromCart - Is checkout started from cart
 * @returns {Object} Processor handling result
 */
function handle( basket, isFromCart ) {
	var methodName = PAYMENT_METHOD;

	var amount = calculateNonGiftCertificateAmount( basket );

	var paymentInstrument = null;

	Transaction.wrap( function() {
		var paymentInstruments = basket.getPaymentInstruments( methodName );

		collections.forEach( paymentInstruments, function( item ) {
			basket.removePaymentInstrument( item );
		} );

		paymentInstrument = basket.createPaymentInstrument( methodName, amount );
	} );

	return {
		success: true,
		paymentInstrument: paymentInstrument
	};
}

function authorizeVCN( order ) {
	var vcnAuthorizationResult = callCreditCardAuthorizationHook( order );

	return vcnAuthorizationResult;
}

function attemptAuthorizeVCNSettlement( order ) {
	var processorResult = callCreditCardAuthorizationHook( order );

	if ( processorResult.error ) {
		failOrder( order );
	}
}

function handleVCNOrder( order, kpOrderID, localeObject ) {
	var isSettlementCreated = _createVCNSettlement( order, kpOrderID, localeObject );

	if ( isSettlementCreated ) {
		attemptAuthorizeVCNSettlement( order );
	} else {
		_cancelOrder( order, localeObject );
		failOrder( order );
	}
}

function authorizeAcceptedOrder( order, kpOrderID, localeObject ) {
	var kpVCNEnabledPreferenceValue = Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' );
	var authorizationResult = {};
	var isSettlementCreated = null;
	var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();

	if( session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !kpVCNEnabledPreferenceValue ) {
		_acknowledgeOrder( session.privacy.KlarnaPaymentsOrderID, localeObject );
	}

	Transaction.wrap( function() {
		paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		session.privacy.OrderNo = orderNo;
		order.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;	
		order.custom.kpIsVCN = empty( kpVCNEnabledPreferenceValue ) ? false : kpVCNEnabledPreferenceValue;
	} );

	if ( session.privacy.KlarnaPaymentsFraudStatus === 'PENDING' ) {
		authorizationResult = { authorized: true };
	} else if ( kpVCNEnabledPreferenceValue ) {
		isSettlementCreated = _createVCNSettlement( order, session.privacy.KlarnaPaymentsOrderID , localeObject );
		if ( isSettlementCreated ) {
			//Plug here your Credit Card Processor
			authorizationResult = callCreditCardAuthorizationHook( order );
		} else {
			_cancelOrder( order, localeObject );

			authorizationResult = { error: true };
		}
	}

	return authorizationResult;
}

/**
 * Update Order Data
 *
 * @param {dw.order.LineItemCtnr} order - Order object
 * @param {string} orderNo - Order Number
 * @param {dw.order.OrderPaymentInstrument} paymentInstrument - current payment instrument
 * @returns {Object} Processor authorizing result
 */
function authorize( order, orderNo, paymentInstrument ) {
	var authorizationResult = {};
	var localeObject = getLocale();

	var klarnaOrderCreated = _createOrder( args.Order, localeObject );

	Transaction.wrap( function() {
		paymentInstrument.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;	
	} );

	if ( !klarnaOrderCreated || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED' ) {
		authorizationResult = { error: true };
	} else {
		authorizationResult = authorizeAcceptedOrder( order, session.privacy.KlarnaPaymentsOrderID, localeObject );
	}

	return authorizationResult;
}

function notify( order, kpOrderID, kpEventType, currentCountry ) {
	var localeObject = getLocale();
	var klarnaOrderService = new KlarnaOrderService();

	if ( klarnaPaymentsFraudDecision === 'FRAUD_RISK_ACCEPTED' ) {
		if ( order.custom.kpIsVCN ) {
			handleVCNOrder( order, kpOrderID, localeObject );
		}

		placeOrder( order, kpOrderID, localeObject );
	} else {
		failOrder( order );
	}
}

module.exports.handle = handle;
module.exports.authorize = authorize;
module.exports.notify = notify;