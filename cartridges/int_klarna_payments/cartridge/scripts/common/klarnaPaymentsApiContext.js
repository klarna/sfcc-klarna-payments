'use strict';

var HashMap = require( 'dw/util/HashMap' );

var KlarnaPaymentsApiContext = function() {};

/**
 * Function that returns the Klarna API endpoints
 * @return {dw.util.HashMap} Hashmap containing the Klarna endpoints
 */
KlarnaPaymentsApiContext.prototype.getFlowApiUrls = function()
{

    if ( !this._flowApiUrls )
    {
        this._flowApiUrls = new HashMap();

        this._flowApiUrls.put( 'createSession', 'payments/v1/sessions' );
        this._flowApiUrls.put( 'updateSession', 'payments/v1/sessions/{0}' );
        this._flowApiUrls.put( 'getSession', 'payments/v1/sessions/{0}' );
        this._flowApiUrls.put( 'getOrder', '/ordermanagement/v1/orders/{0}' );
        this._flowApiUrls.put( 'cancelAuthorization', 'payments/v1/authorizations/{0}' );
        this._flowApiUrls.put( 'createOrder', 'payments/v1/authorizations/{0}/order' );
        this._flowApiUrls.put( 'cancelOrder', '/ordermanagement/v1/orders/{0}/cancel' );
        this._flowApiUrls.put( 'vcnSettlement', 'merchantcard/v3/settlements' );
        this._flowApiUrls.put( 'createCapture', '/ordermanagement/v1/orders/{0}/captures' );
        this._flowApiUrls.put( 'createCustomerToken', 'payments/v1/authorizations/{0}/customer-token' );
        this._flowApiUrls.put( 'cancelCustomerToken', 'customer-token/v1/tokens/{0}/status' );
        this._flowApiUrls.put( 'createRecurringOrder', 'customer-token/v1/tokens/{0}/order' );
        this._flowApiUrls.put( 'refreshSignInToken', '{0}/lp/idp/oauth2/token' );
        this._flowApiUrls.put( 'getKlarnaJWKS', '{0}/lp/idp/.well-known/jwks.json' );
    }

    return this._flowApiUrls;
};

/**
 * Function that returns the Klarna API service ID
 * @return {dw.util.HashMap} Hashmap containing the Klarna service ID
 */
 KlarnaPaymentsApiContext.prototype.getFlowApiIds = function()
 {
 
     if ( !this._flowApiIds )
     {
         this._flowApiIds = new HashMap();
 
         this._flowApiIds.put( 'createSession', 'klarna.http.createSession' );
         this._flowApiIds.put( 'updateSession', 'klarna.http.updateSession' );
         this._flowApiIds.put( 'getSession', 'klarna.http.getSession' );
         this._flowApiIds.put( 'getOrder', 'klarna.http.getOrder' );
         this._flowApiIds.put( 'cancelAuthorization', 'klarna.http.cancelAuthorization' );
         this._flowApiIds.put( 'createOrder', 'klarna.http.createOrder' );
         this._flowApiIds.put( 'cancelOrder', 'klarna.http.cancelOrder' );
         this._flowApiIds.put( 'vcnSettlement', 'klarna.http.vcnSettlement' );
         this._flowApiIds.put( 'createCapture', 'klarna.http.createCapture' );
         this._flowApiIds.put( 'createCustomerToken', 'klarna.http.createCustomerToken' );
         this._flowApiIds.put( 'cancelCustomerToken', 'klarna.http.cancelCustomerToken' );
         this._flowApiIds.put( 'createRecurringOrder', 'klarna.http.createRecurringOrder' );
         this._flowApiIds.put( 'refreshSignInToken', 'klarna.http.signIn' );
         this._flowApiIds.put( 'getKlarnaJWKS', 'klarna.http.signIn' );
     }
 
     return this._flowApiIds;
 };

module.exports = KlarnaPaymentsApiContext;
