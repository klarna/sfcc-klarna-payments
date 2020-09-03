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
var PaymentInstrument = require( 'dw/order/PaymentInstrument' );
var Site = require( 'dw/system/Site' );
var Locale = require( 'dw/util/Locale' );

var COSummary = require( '*/cartridge/controllers/COSummary.js' );

/* Script Modules */
var log = Logger.getLogger( 'KLARNA_PAYMENTS.js' );
var guard = require( '*/cartridge/scripts/guard' );
var Countries = require( '*/cartridge/scripts/util/Countries' );
var KlarnaPayments = {
	httpService 			: require( '*/cartridge/scripts/common/KlarnaPaymentsHttpService.ds' ),
	apiContext 				: require( '*/cartridge/scripts/common/KlarnaPaymentsApiContext' ),
	sessionRequestBuilder 	: require( '*/cartridge/scripts/session/KlarnaPaymentsSessionRequestBuilder' ), 
	orderRequestBuilder 	: require( '*/cartridge/scripts/order/KlarnaPaymentsOrderRequestBuilder' )
};
var Utils = require( '*/cartridge/scripts/checkout/Utils' );

/**
 * Find the first klarna payment transaction within the order (if exists).
 *
 * @param {dw.order.Order} order - The Order currently being placed.
 * @returns {dw.order.PaymentTransaction} Klarna Payment Transaction
 */
function findKlarnaPaymentTransaction( order ) {
	var paymentTransaction = null;
	var paymentInstruments = order.getPaymentInstruments( "Klarna" );

	if ( !empty( paymentInstruments ) && paymentInstruments.length ) {
		paymentTransaction = paymentInstruments[0].paymentTransaction;
	}

	return paymentTransaction;
}

/**
 * Returns full order amount for a DW order.
 *
 * @param {dw.order.Order} dwOrder DW Order object.
 * @return {dw.value.Money} payment transaction amount.
 */
function getPaymentInstrumentAmount( dwOrder ) {
	var kpTransaction = findKlarnaPaymentTransaction( dwOrder );

	var transactionAmount = kpTransaction.getAmount();

	return transactionAmount;
}

/**
 * Handle auto-capture functionality.
 *
 * @param {dw.order.Order} dwOrder DW Order object.
 * @param {string} kpOrderId Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject locale object (KlarnaCountries).
 * @returns {void}
 */
function handleAutoCapture( dwOrder, kpOrderId, localeObject ) {
	var captureData = {
		amount: Math.round( getPaymentInstrumentAmount( dwOrder ).getValue() * 100 )
	};

	try {
		_createCapture( kpOrderId, localeObject, captureData );

		Transaction.wrap( function() {
			dwOrder.setPaymentStatus( dwOrder.PAYMENT_STATUS_PAID );
		} );
	} catch ( e ) {
		log.error( 'Error in creating Klarna Payments Order Capture: {0}', e.message + e.stack );

		throw e;
	}
}

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

	if ( basket === null ) {
		return {
			error: true
		};
	}

	Transaction.wrap( function()
	{
		paymentInstrs = basket.getPaymentInstruments();
		iter = paymentInstrs.iterator();
		existingPI = null;

		// remove all PI except gift certificates
		while( iter.hasNext() )
		{
			existingPI = iter.next();
			if ( !PaymentInstrument.METHOD_GIFT_CERTIFICATE.equals( existingPI.paymentMethod ) ) 
			{
				args.Basket.removePaymentInstrument( existingPI );
			}		
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
function authorize( args ) // eslint-disable-line complexity
{
	var orderNo = args.OrderNo;
	var paymentInstrument = args.PaymentInstrument;
	var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();
	var localeObject = getLocale();
	
	var klarnaOrderCreated = _createOrder( args.Order, localeObject );
	var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpAutoCapture' );
	
	Transaction.wrap( function()
	{
		paymentInstrument.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;	
	} );

	if( !klarnaOrderCreated || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED' )
	{
		return { error: true };
	}

	session.privacy.KlarnaPaymentsAuthorizationToken = null;
	session.privacy.KlarnaPaymentsFinalizeRequired = null;

	if( session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' ) )
	{

		if ( autoCaptureEnabled ) {
			try {
				handleAutoCapture( args.Order, session.privacy.KlarnaPaymentsOrderID, localeObject );
			} catch ( e ) {
				return { error: true };
			}
		}

		_acknowledgeOrder( session.privacy.KlarnaPaymentsOrderID, localeObject );
	}
	
	Transaction.wrap( function()
	{
		paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
		paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
		session.privacy.OrderNo = orderNo;
		args.Order.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;	
		args.Order.custom.kpIsVCN = empty( Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' ) ) ? false : Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' );
	} );

	if ( session.privacy.KlarnaPaymentsFraudStatus === 'PENDING' )
	{
		return { authorized: true };
	}

	if ( Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' ) )
	{
		var isSettlementCreated = _createVCNSettlement( args.Order, session.privacy.KlarnaPaymentsOrderID, localeObject ); // eslint-disable-line vars-on-top
		if ( isSettlementCreated ) 
		{
			//Plug here your Credit Card Processor
			return require( '*/cartridge/scripts/payment/processor/BASIC_CREDIT' ).Authorize( {'OrderNo':args.Order.getOrderNo(),'PaymentInstrument': args.Order.getPaymentInstruments( "Klarna" )[0]} );
		}

		_cancelOrder( args.Order,localeObject );
		return { error: true };
	}
	
	return { authorized: true };
}

/**
 * Attempts to create a full-amount capture through Klarna API.
 * @param {string} klarnaOrderID KP Order ID
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries.
 * @param {Object} captureData capture data.
 * @returns {void}
 */
function _createCapture( klarnaOrderID, localeObject, captureData ) {
	var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
	var klarnaApiContext = new KlarnaPayments.apiContext();
	var requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createCapture' ), klarnaOrderID );
	var requestBody = {
		captured_amount: captureData.amount
	};

	klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
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
	var klarnaAuthorizationToken = session.privacy.KlarnaPaymentsAuthorizationToken;
	
	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestBody = _getOrderRequestBody( order, localeObject );
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'createOrder' ), klarnaAuthorizationToken );
		
		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
		
		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsOrderID = response.order_id;
			session.privacy.KlarnaPaymentsRedirectURL = response.redirect_url;
			session.privacy.KlarnaPaymentsFraudStatus = response.fraud_status;
		} );
	} catch( e ) 
	{
		log.error( 'Error in creating Klarna Payments Order: {0}', e );
		return false;
	}  
	return true;
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

	try {
		klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestUrl = klarnaApiContext.getFlowApiUrls().get( 'vcnSettlement' );
		requestBody = {
			'order_id' : klarnaPaymentsOrderID,
			'key_id' : Site.getCurrent().getCustomPreferenceValue( 'kpVCNkeyId' )
		};

		response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
		if( empty( response.settlement_id ) || empty( response.cards ) )
		{
			log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
			return false;
		}

		Transaction.wrap( function()
		{
			order.custom.kpVCNBrand = response.cards[0].brand;
			order.custom.kpVCNHolder = response.cards[0].holder;
			order.custom.kpVCNCardID = response.cards[0].card_id;
			order.custom.kpVCNPCIData = response.cards[0].pci_data;
			order.custom.kpVCNIV = response.cards[0].iv;
			order.custom.kpVCNAESKey = response.cards[0].aes_key;
			order.custom.kpIsVCN = true;
		} );
	} catch( e ) 
	{
		log.error( 'Error in creating Klarna Payments VCN Settlement: {0}', e );
		return false;
	}
	return true;
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

function buildKlarnaCompatibleLocale() {
	var requestLocale = Locale.getLocale( request.locale );
	var resultLocale = requestLocale.language;

	if ( requestLocale.country ) {
		resultLocale = resultLocale + '-' + requestLocale.country;
	}

	return resultLocale.toLowerCase();
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
	var countryCode = currentCountry;

	if ( empty( countryCode ) )
	{
		countryCode = Countries.getCurrent( {CurrentRequest: request} ).countryCode; // eslint-disable-line no-param-reassign
	}
	else
	{
		countryCode = 'default';
	}

	var customlocaleObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', countryCode );
	if ( customlocaleObject )
	{
		localeObject.custom = {};
		Object.keys( customlocaleObject.custom ).forEach( function( key ) {
			localeObject.custom[key] = customlocaleObject.custom[key];
		} );

		if ( countryCode !== 'default' )
		{
			localeObject.custom.klarnaLocale = buildKlarnaCompatibleLocale();
		}
	}

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
	
	if( !empty( session.privacy.KlarnaPaymentsSessionID ) )
	{
		updateSession();
		var currentCookies = request.getHttpCookies();
		if ( currentCookies.hasOwnProperty( 'selectedKlarnaPaymentCategory' ) ) {
			session.privacy.SelectedKlarnaPaymentMethod = currentCookies['selectedKlarnaPaymentCategory'].value; // eslint-disable-line dot-notation
		}
	}
	else
	{
		try {
			klarnaPaymentsHttpService = new KlarnaPayments.httpService();
			klarnaApiContext = new KlarnaPayments.apiContext();
			requestBody = _getSessionRequestBody( BasketMgr.getCurrentBasket(), localeObject );
			requestUrl = klarnaApiContext.getFlowApiUrls().get( 'createSession' );

			response = klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );
			var klarnaPaymentMethods = response.payment_method_categories ? JSON.stringify( response.payment_method_categories ) : null;

			Transaction.wrap( function()
			{
				session.privacy.KlarnaPaymentsSessionID = response.session_id;
				session.privacy.KlarnaPaymentsClientToken = response.client_token;
				session.privacy.KlarnaPaymentMethods = klarnaPaymentMethods;
				session.privacy.SelectedKlarnaPaymentMethod = null;
			} );
		} catch( e ) 
		{
			log.error( 'Error in creating Klarna Payments Session: {0}', e );
			Transaction.wrap( function()
			{
				session.privacy.KlarnaPaymentsSessionID = null;
				session.privacy.KlarnaPaymentsClientToken = null;
				session.privacy.KlarnaPaymentMethods = null;
				session.privacy.SelectedKlarnaPaymentMethod = null;
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
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateSession' ), session.privacy.KlarnaPaymentsSessionID );

		// Update session
		klarnaPaymentsHttpService.call( requestUrl, 'POST', localeObject.custom.credentialID, requestBody );

		// Read updated session
		response = klarnaPaymentsHttpService.call( requestUrl, 'GET', localeObject.custom.credentialID );
		var klarnaPaymentMethods = response.payment_method_categories ? JSON.stringify( response.payment_method_categories ) : null;

		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsClientToken = response.client_token;
			session.privacy.KlarnaPaymentMethods = klarnaPaymentMethods;
		} );

	} catch( e )
	{
		log.error( 'Error in updating Klarna Payments Session: {0}', e );
		Transaction.wrap( function()
		{
			session.privacy.KlarnaPaymentsSessionID = null;
			session.privacy.KlarnaPaymentsClientToken = null;
			session.privacy.KlarnaPaymentMethods = null;
			session.privacy.SelectedKlarnaPaymentMethod = null;
		} );
	}  
}

/**
 * Entry point for showing confirmation page after Klarna redirect
 * 
 * @return {Object} call call COSummary to show confirmation
 */
function confirmation() {
	var order = OrderMgr.getOrder( session.privacy.OrderNo );
	
	return COSummary.ShowConfirmation( order );
}


/**
 * Call Klarna Payments API to get an order
 * @param {string} klarnaPaymentsOrderID Klarna Payments Order ID
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Object} Klarna order
 */
function _getKlarnaOrder( klarnaPaymentsOrderID )
{
	var klarnaHttpService = {};
	var klarnaApiContext = {};
	var klarnaOrderID = klarnaPaymentsOrderID;
	var localeObject = getLocale();
	var requestUrl = '';

	try {
		klarnaHttpService = new KlarnaPayments.httpService();
		klarnaApiContext = new KlarnaPayments.apiContext();
		requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'getOrder' ), klarnaOrderID );

		return klarnaHttpService.call( requestUrl, 'GET', localeObject.custom.credentialID );
	} catch( e )
	{
		log.error( 'Error while retrieving order: {0}', e );
	}

	return null;
}

/**
 * Entry point for notifications on pending orders
 * 
 * @return {void}
 */
function notification()
{
	var currentCountry = request.httpParameterMap.klarna_country.value;
	var localeObject = getLocale( currentCountry );
	var FRAUD_STATUS_MAP = require( '*/cartridge/scripts/util/KlarnaPaymentsConstants.js' ).FRAUD_STATUS_MAP;

	var klarnaPaymentsFraudDecisionObject = JSON.parse( request.httpParameterMap.requestBodyAsString );
	var klarnaPaymentsOrderID = klarnaPaymentsFraudDecisionObject.order_id;
	var klarnaPaymentsFraudDecision = klarnaPaymentsFraudDecisionObject.event_type;

	var klarnaOrder = _getKlarnaOrder( klarnaPaymentsOrderID );
	if ( klarnaOrder && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] === klarnaPaymentsFraudDecision )
	{
		var order = OrderMgr.queryOrder( "custom.kpOrderID ={0}", klarnaPaymentsOrderID );
		if( empty( order ) )
		{
			return response.setStatus( 200 );
		}
		Transaction.wrap( function()
		{
			order.getPaymentInstruments( "Klarna" )[0].paymentTransaction.custom.kpFraudStatus = klarnaPaymentsFraudDecision;
		} );
		if( klarnaPaymentsFraudDecision === 'FRAUD_RISK_ACCEPTED' )
		{
			if ( order.custom.kpIsVCN )
			{
				var isSettlementCreated = _createVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
				if ( isSettlementCreated )
				{
					//Plug here your Credit Card Processor
					var authObj = require( '*/cartridge/scripts/payment/processor/BASIC_CREDIT' ).Authorize( {'OrderNo':order.getOrderNo(),'PaymentInstrument': order.getPaymentInstruments( "Klarna" )[0]} );
					if( authObj.error )
					{
						Transaction.wrap( function()
						{
							OrderMgr.failOrder( order );
						} );
						return response.setStatus( 200 );
					}
				}
				else
				{
					_cancelOrder( order, localeObject );
					Transaction.wrap( function()
					{
						OrderMgr.failOrder( order );
					} );
					return response.setStatus( 200 );
				}
			}
			placeOrder( order, klarnaPaymentsOrderID, localeObject );
	
		}
		else
		{
			Transaction.wrap( function()
			{
				OrderMgr.failOrder( order );
			} );
		}
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

	if ( !order.custom.kpIsVCN ) {
		try {
			var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpAutoCapture' );
	
			if ( autoCaptureEnabled ) {
				handleAutoCapture( order, klarnaPaymentsOrderID, localeObject );
			}
	
			_acknowledgeOrder( klarnaPaymentsOrderID, localeObject );
		} catch ( e ) {
			log.error( 'Order could not be placed: {0}', e.message + e.stack );
		}
	}

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
		session.privacy.KlarnaPaymentsSessionID = null;
		session.privacy.KlarnaPaymentsClientToken = null;
		session.privacy.KlarnaPaymentMethods = null;
		session.privacy.SelectedKlarnaPaymentMethod = null;
	} );
	
	if( !empty( session.privacy.KlarnaPaymentsRedirectURL ) )
	{
		response.redirect( session.privacy.KlarnaPaymentsRedirectURL );
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
		session.privacy.KlarnaPaymentsSessionID = null;
		session.privacy.KlarnaPaymentsClientToken = null;
		session.privacy.KlarnaPaymentMethods = null;
		session.privacy.SelectedKlarnaPaymentMethod = null;
	} ); 
}

/**
 * Saves/Updates Klarna Payments authorization token in the current session
 * 
 * @return {void}
 */
function saveAuth()
{
	// Cancel any previous authorizations
	// cancelAuthorization();

	Transaction.wrap( function()
	{
		session.privacy.KlarnaPaymentsAuthorizationToken = request.httpHeaders['x-auth'];
		session.privacy.KlarnaPaymentsFinalizeRequired = request.httpHeaders['finalize-required'] === 'true';
	} ); 
	
	response.setStatus( 200 );
}

/**
 * Deletes the previous authorization
 * @param {string} authToken Authorization Token
 * @return {string} Service call result
 */
function cancelAuthorization( authToken ) {
	var klarnaAuthorizationToken = authToken || session.privacy.KlarnaPaymentsAuthorizationToken;

	if ( klarnaAuthorizationToken ) {
		var klarnaPaymentsHttpService = new KlarnaPayments.httpService();
		var klarnaApiContext = new KlarnaPayments.apiContext();
		var requestUrl = StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'cancelAuthorization' ), klarnaAuthorizationToken );
		var localeObject = getLocale();

		try {
			var response = klarnaPaymentsHttpService.call( requestUrl, 'DELETE', localeObject.custom.credentialID );
			session.privacy.KlarnaPaymentsAuthorizationToken = null;
			session.privacy.KlarnaPaymentsFinalizeRequired = null;
			return response;
		} catch ( e ) {
			log.error( 'Error in canceling Klarna Payments Authorization: {0}', e.message + e.stack );
		}
	}

	return null;
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
exports.CancelAuthorization = cancelAuthorization;