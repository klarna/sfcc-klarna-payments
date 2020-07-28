'use strict';

let HashMap = require( 'dw/util/HashMap' );

let KlarnaPaymentsApiContext = function() {};

KlarnaPaymentsApiContext.prototype.getFlowApiUrls = function()
{

	if ( !this._flowApiUrls )
	{
		this._flowApiUrls = new HashMap();

		this._flowApiUrls.put( 'createSession', 'payments/v1/sessions' );
		this._flowApiUrls.put( 'updateSession', 'payments/v1/sessions/{0}' );
		this._flowApiUrls.put( 'getOrder', '/ordermanagement/v1/orders/{0}' );
		this._flowApiUrls.put( 'cancelAuthorization', 'payments/v1/authorizations/{0}' );
		this._flowApiUrls.put( 'createOrder', 'payments/v1/authorizations/{0}/order' );
		this._flowApiUrls.put( 'cancelOrder', '/ordermanagement/v1/orders/{0}/cancel' );
		this._flowApiUrls.put( 'acknowledgeOrder', 'ordermanagement/v1/orders/{0}/acknowledge' );		
		this._flowApiUrls.put( 'vcnSettlement', 'merchantcard/v3/settlements' );
		this._flowApiUrls.put( 'createCapture', '/ordermanagement/v1/orders/{0}/captures' );
	}

	return this._flowApiUrls;
};

module.exports = KlarnaPaymentsApiContext;
