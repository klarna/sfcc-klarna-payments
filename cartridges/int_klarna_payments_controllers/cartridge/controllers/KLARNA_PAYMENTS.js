'use strict';

/**
 * Controller for all Klarna Payments related functions.
 *
 * @module controllers/KLARNA_PAYMENTS
 */

/* API Includes */
var PaymentMgr = require( 'dw/order/PaymentMgr' );
var Transaction = require( 'dw/system/Transaction' );
var Logger = require( 'dw/system/Logger' );
var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var BasketMgr = require( 'dw/order/BasketMgr' );
var OrderMgr = require( 'dw/order/OrderMgr' );
var StringUtils = require( 'dw/util/StringUtils' );
var Status = require( 'dw/system/Status' );

var COSummary = require( 'sitegenesis_storefront_controllers/cartridge/controllers/COSummary.js' );

/* Script Modules */
var log = Logger.getLogger( 'KLARNA_PAYMENTS.js' );
var guard = require( '~/cartridge/scripts/guard' );
var Countries = require( 'int_klarna_payments/cartridge/scripts/util/Countries' );
var KlarnaPayments = {
	httpService 			: require( 'int_klarna_payments/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( 'int_klarna_payments/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( 'int_klarna_payments/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( 'int_klarna_payments/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};
var Utils = require( 'int_klarna_payments/cartridge/scripts/checkout/Utils.ds' );


/**
 * Creates a Klarna payment instrument for the given basket
 * @param {Object} args object containing Basket (dw.order.Basket), PaymentMethodID (string) properties
 * 
 * @return {Object} handleObject if handle is successfull { success: true }, otherwise { error: true }
 */
function handle( args )
{
	var basket = args.Basket;
	var paymentInstrs = [];
	var iter = {};
	var existingPI = {};
	var amount = 0;
	
	Transaction.wrap( function()
	{
		if( basket === null )	
		{
			return { error: true };
		}

		paymentInstrs = basket.getPaymentInstruments();
		iter = paymentInstrs.iterator();
		existingPI = null;

		while( iter.hasNext() )
		{
			existingPI = iter.next();
			basket.removePaymentInstrument( existingPI );
		}		
		amount = Utils.calculateNonGiftCertificateAmount( basket );
		basket.createPaymentInstrument( "Klarna", amount );		
	} );

	return {
		success: true
	};
}

/**
 * Authorizes a payment using a KLARNA_PAYMENTS processor.
 * @param {Object} args object containing OrderNo (string), Order (dw.order.Order) and PaymentInstrument(dw.order.PaymentInstrument) properties
 * 
 * @return {Object} authObject if authorization is successfull { authorized: true }, otherwise { error: true }
 */
function authorize( args )
{
	var orderNo = args.OrderNo;
	var paymentInstrument = args.PaymentInstrument;
	var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();
	var localeObject = getLocale();
	
	var klarnaOrderCreated = _createOrder( args.Order, localeObject );

	if( !klarnaOrderCreated || session.custom.KlarnaPaymentsFraudStatus === 'REJECTED' )
	{
		return { error: true };
	}
	if( session.custom.KlarnaPaymentsFraudStatus === 'ACCEPTED' )
	{
		_acknowledgeOrder( session.custom.KlarnaPaymentsOrderID, localeObject );
	}
	
	Transaction.wrap( function()
	{
		paymentInstrument.paymentTransaction.transactionID = session.custom.KlarnaPaymentsOrderID;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		session.custom.OrderNo = orderNo;
		args.Order.custom.kpOrderID = session.custom.KlarnaPaymentsOrderID;		
	} );	
	
	return { authorized: true };
}

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
	var klarnaAuthorizationToken = session.custom.KlarnaPaymentsAuthorizationToken;
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getOrderRequestBody( order, localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createOrder' ), klarnaAuthorizationToken );
		
		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
		
		Transaction.wrap( function()
		{
			session.custom.KlarnaPaymentsOrderID = response.order_id;
			session.custom.KlarnaPaymentsRedirectURL = response.redirect_url;
			session.custom.KlarnaPaymentsFraudStatus = response.fraud_status;
		} );
	} catch( e ) 
	{
		log.error( 'Error in creating Klarna Payments Order: {0}', e );
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
	if ( empty( currentCountry ) )
	{
		currentCountry = Countries.getCurrent( {CurrentRequest: request} ).countryCode;
	}   

	localeObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', currentCountry );
	
	return localeObject;
}

/**
 * Creates a Klarna payments session through Klarna API
 * 
 * @return {void}
 */
function createSession() {
	var localeObject = getLocale();
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	
	if( !empty( session.custom.KlarnaPaymentsSessionID ) )
	{
		updateSession();
	}
	else
	{
		try {
			klarnaPaymentsHttpService = new KlarnaPayments.httpService();
			klarnaApiContext = new KlarnaPayments.apiContext();
			requestBody = _getSessionRequestBody( BasketMgr.getCurrentBasket(), localeObject );
			requestUrl = klarnaApiContext.getFlowApiUrls().get( 'createSession' );
			
			response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
			if( response!=='OK' )
			{
				Transaction.wrap( function()
				{
					session.custom.KlarnaPaymentsSessionID = null;
					session.custom.KlarnaPaymentsClientToken = null;
				} );			
			}
			Transaction.wrap( function()
			{
				session.custom.KlarnaPaymentsSessionID = response.session_id;
				session.custom.KlarnaPaymentsClientToken = response.client_token;
			} );
		} catch( e ) 
		{
			log.error( 'Error in creating Klarna Payments Session: {0}', e );
			Transaction.wrap( function()
			{
				session.custom.KlarnaPaymentsSessionID = null;
				session.custom.KlarnaPaymentsClientToken = null;
			} );
		}
	
	}   	
}

/**
 * Creates a Klarna payments session through Klarna API
 * @param {dw.order.Basket} 		basket			SCC Basket object
 * @param {dw.object.CustomObject} 	localeObject 	corresponding to the locale Custom Object from KlarnaCountries
 * 
 * @private
 * @return {Object} requestObject Klarna Payments request object
 */
function _getSessionRequestBody( basket, localeObject )
{
	var sessionRequestBuilder = new KlarnaPayments.sessionRequestBuilder();
	
	return sessionRequestBuilder.buildRequest( {
		basket: basket,
		localeObject: localeObject
	} ).get();
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
 * Updates a Klarna payments session through Klarna API
 * 
 * @return {void}
 */
function updateSession() {
	var localeObject = getLocale();
	var klarnaPaymentsHttpService = {};
	var klarnaApiContext = {};
	var requestBody = {};
	var requestUrl = '';
	var response = {};
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getSessionRequestBody( BasketMgr.getCurrentBasket(), localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateSession' ), session.custom.KlarnaPaymentsSessionID );
		
		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
		if( response!=='OK' )
		{
			Transaction.wrap( function()
			{
				session.custom.KlarnaPaymentsSessionID = null;
				session.custom.KlarnaPaymentsClientToken = null;
			} );			
		}
	} catch( e )
	{
		log.error( 'Error in updating Klarna Payments Session: {0}', e );
		Transaction.wrap( function()
		{
			session.custom.KlarnaPaymentsSessionID = null;
			session.custom.KlarnaPaymentsClientToken = null;
		} );
	}  
}

/**
 * Entry point for showing confirmation page after Klarna redirect
 * 
 * @return {Object} call call COSummary to show confirmation
 */
function confirmation() {
	var order = OrderMgr.getOrder( session.custom.OrderNo );
	
	return COSummary.ShowConfirmation( order );
}

/**
 * Entry point for notifications on pending orders
 * 
 * @return {void}
 */
function notification()
{
	var klarnaPaymentsFraudDecisionObject = JSON.parse( request.httpParameterMap.requestBodyAsString );
	var klarnaPaymentsOrderID = klarnaPaymentsFraudDecisionObject.order_id;
	var klarnaPaymentsFraudDecision = klarnaPaymentsFraudDecisionObject.event_type;
	var currentCountry = request.httpParameterMap.klarna_country.value;
	var localeObject = getLocale( currentCountry );
	var order = OrderMgr.queryOrder( "custom.kpOrderID ={0}", klarnaPaymentsOrderID );
	
	if( empty( order ) )
	{
		return response.setStatus( 200 );
	}
	if( klarnaPaymentsFraudDecision === 'FRAUD_RISK_ACCEPTED' )
	{
		placeOrder( order, klarnaPaymentsOrderID, localeObject );
		
	} else
	{
		Transaction.wrap( function()
		{
			OrderMgr.failOrder( order );
		} );
	}	
	return response.setStatus( 200 );
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
function placeOrder( order, klarnaPaymentsOrderID, localeObject )
{
	Transaction.wrap( function()
	{
		var placeOrderStatus = OrderMgr.placeOrder( order );
		if ( placeOrderStatus === Status.ERROR )
		{
			OrderMgr.failOrder( order );
			throw new Error( 'Failed to place order.' );
		}
		order.setConfirmationStatus( order.CONFIRMATION_STATUS_CONFIRMED );
		order.setExportStatus( order.EXPORT_STATUS_READY );
	} );
	
	_acknowledgeOrder( klarnaPaymentsOrderID, localeObject );
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
	} catch( e )
	{
		log.error( 'Error in updating Klarna Payments Session: {0}', e );
	}
}

/**
 * Redirect the customer to the Klrana Payments redirect_url.
 * The reason for this redirect is to allow Klarna to recognize the customer's device in future interactions.
 * 
 * @return {void}
 */
function redirect()
{
	Transaction.wrap( function()
	{
		session.custom.KlarnaPaymentsSessionID = null;
		session.custom.KlarnaPaymentsClientToken = null;
	} );
	
	if( !empty( session.custom.KlarnaPaymentsRedirectURL ) )
	{
		response.redirect( session.custom.KlarnaPaymentsRedirectURL );
	}
}

/**
 * Place order with KlarnaPaymentsFraudStatus === 'PENDING'
 * set the export status to EXPORT_STATUS_NOTEXPORTED, set the confirmation status to NOTCONFIRMED, set the payment status to NOT PAID
 * @param {dw.order.Order} 			order 					SCC order object
 * 
 * @return {void}
 */
function pendingOrder( order )
{
	order.setExportStatus( order.EXPORT_STATUS_NOTEXPORTED );
	order.setConfirmationStatus( order.CONFIRMATION_STATUS_NOTCONFIRMED );
	order.setPaymentStatus( order.PAYMENT_STATUS_NOTPAID );
}

/**
 * Clear Klarna Payments session and token from current session
 * 
 * @return {void}
 */
function clearSession()
{
	Transaction.wrap( function()
	{
		session.custom.KlarnaPaymentsSessionID = null;
		session.custom.KlarnaPaymentsClientToken = null;
	} ); 
}

/**
 * Saves/Updates Klarna Payments authorization token in the current session
 * 
 * @return {void}
 */
function saveAuth()
{
	Transaction.wrap( function()
	{
		session.custom.KlarnaPaymentsAuthorizationToken = request.httpHeaders['x-auth'];
	} ); 
	
	response.setStatus( 200 );
}
/*
 * Module exports
 */

/* Web exposed methods */

/** Creates a Klarna payments session through Klarna API */
exports.CreateSession = guard.ensure( ['https'], createSession );
/** Updates a Klarna payments session through Klarna API */
exports.UpdateSession = guard.ensure( ['get', 'https'], updateSession );
/** Entry point for showing confirmation page after Klarna redirect */
exports.Confirmation = guard.ensure( ['get', 'https'], confirmation );
/** Entry point for notifications on pending orders */
exports.Notification = guard.ensure( ['post', 'https'], notification );
/** Clear Klarna Payments session and token from current session */
exports.ClearSession = guard.ensure( ['get'], clearSession );
/** Saves/Updates Klarna Payments authorization token in the current session */
exports.SaveAuth = guard.ensure( ['get'], saveAuth );

/*
 * Local methods
 */
exports.Handle = handle;
exports.Authorize = authorize;
exports.GetLocale = getLocale;
exports.CreateSession = createSession;
exports.Redirect = redirect;
exports.PendingOrder = pendingOrder;