'use strict';

/**
 * Controller for all Klarna Payments related functions.
 *
 * @module controllers/KlarnaPayments
 */

/* API Includes */
var PaymentMgr = require( 'dw/order/PaymentMgr' );
var Transaction = require( 'dw/system/Transaction' );
var Logger = require( 'dw/system/Logger' );
var BasketMgr = require( 'dw/order/BasketMgr' );
var OrderMgr = require( 'dw/order/OrderMgr' );
var Status = require( 'dw/system/Status' );
var Site = require( 'dw/system/Site' );

/* Script Modules */
var log = Logger.getLogger( 'KlarnaPayments.js' );
var guard = require( '*/cartridge/scripts/guard' );

/**
 * Creates a Klarna payment instrument for the given basket
 * @param {Object} args object containing Basket (dw.order.Basket), PaymentMethodID (string) properties
 *
 * @return {Object} handleObject if handle is successfull { success: true }, otherwise { error: true }
 */
function handle( args ) {
    var removeHelper = require( '*/cartridge/scripts/klarnaRemovePreviousPI' );
    var createHelper = require( '*/cartridge/scripts/createKlarnaPaymentInstrument' );

    var removeResult = Transaction.wrap( function() {
        return removeHelper.removePaymentInstruments( args );
    } );

    if ( !removeResult.success ) {
        return {
            error: true
        };
    }

    var createResult = Transaction.wrap( function() {
        return createHelper.createPaymentIntrument( args );
    } );

    if ( empty( createResult ) ) {
        return {
            error: true
        };
    }

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
function authorize( args ) { // eslint-disable-line complexity
    var createOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCreateOrder' );
    var orderNo = args.OrderNo;
    var paymentInstrument = args.PaymentInstrument;
    var paymentProcessor = PaymentMgr.getPaymentMethod( paymentInstrument.getPaymentMethod() ).getPaymentProcessor();
    var localeObject = getLocale();

    var klarnaCreateOrderResponse = createOrderHelper.createOrder( args.Order, localeObject, session.privacy.KlarnaPaymentsAuthorizationToken );
    session.privacy.KlarnaPaymentsOrderID = klarnaCreateOrderResponse.order_id;
    session.privacy.KlarnaPaymentsRedirectURL = klarnaCreateOrderResponse.redirect_url;
    session.privacy.KlarnaPaymentsFraudStatus = klarnaCreateOrderResponse.fraud_status;
    var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpAutoCapture' );
    var vcnEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpVCNEnabled' );

    Transaction.wrap( function() {
        paymentInstrument.paymentTransaction.custom.kpFraudStatus = session.privacy.KlarnaPaymentsFraudStatus;

        if ( autoCaptureEnabled && !vcnEnabled ) {
            paymentInstrument.paymentTransaction.type = dw.order.PaymentTransaction.TYPE_CAPTURE;
        } else {
            paymentInstrument.paymentTransaction.type = dw.order.PaymentTransaction.TYPE_AUTH;
        }
    } );

    if( !klarnaCreateOrderResponse.success || session.privacy.KlarnaPaymentsFraudStatus === 'REJECTED' ) {
        return { error: true };
    }

    session.privacy.KlarnaPaymentsAuthorizationToken = null;
    session.privacy.KlarnaPaymentsFinalizeRequired = null;

    if( session.privacy.KlarnaPaymentsFraudStatus === 'ACCEPTED' && !vcnEnabled ) {

        if ( autoCaptureEnabled ) {
            try {
                Transaction.wrap( function() {
                    var klarnaPaymentsCaptureOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCaptureOrder' );
                    klarnaPaymentsCaptureOrderHelper.handleAutoCapture( args.Order, session.privacy.KlarnaPaymentsOrderID, localeObject );
                } );
            } catch ( e ) {
                return { error: true };
            }
        }
    }

    Transaction.wrap( function() {
        paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        session.privacy.OrderNo = orderNo;
        args.Order.custom.kpOrderID = session.privacy.KlarnaPaymentsOrderID;
        args.Order.custom.kpIsVCN = empty( vcnEnabled ) ? false : vcnEnabled;
    } );

    if ( session.privacy.KlarnaPaymentsFraudStatus === 'PENDING' ) {
        return { authorized: true };
    }

    if ( vcnEnabled ) {
        var isSettlementCreated = _handleVCNSettlement( args.Order, session.privacy.KlarnaPaymentsOrderID, localeObject ); // eslint-disable-line vars-on-top
        if ( isSettlementCreated ) {
            //Plug here your Credit Card Processor
            return require( '*/cartridge/scripts/payment/processor/BASIC_CREDIT' ).Authorize( {'OrderNo':args.Order.getOrderNo(),'PaymentInstrument': args.Order.getPaymentInstruments( "Klarna" )[0]} );
        }
        var klarnaPaymentsCancelOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCancelOrder' );
        klarnaPaymentsCancelOrderHelper.cancelOrder( localeObject, args.Order );
        return { error: true };
    }

    return { authorized: true };
}

/**
 * Handles VCN settlement
 *
 * If the settlement retry has been enabled, we will retry to settle the order in case the first one failed
 *
 * @param {dw.order.Order} order SCC order object
 * @param {string} klarnaPaymentsOrderID Klarna Payments order id
 * @param {dw.object.CustomObject} localeObject corresponding to the locale Custom Object from KlarnaCountries
 *
 * @return {Boolean} true if VCN settlement is created successfully, otherwise false
 */
function _handleVCNSettlement( order, klarnaPaymentsOrderID, localeObject ) {
    var vcnHelper = require( '*/cartridge/scripts/VCN/klarnaPaymentsVCNSettlement' );
    return vcnHelper.handleVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
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
    var getKlarnaPaymentsLocale = require( '*/cartridge/scripts/locale/klarnaPaymentsGetLocale' );
    var localeObjectResult = getKlarnaPaymentsLocale.getLocaleObject( currentCountry );

    if ( localeObjectResult.success ) {
        localeObject = localeObjectResult.localeObject;
    }

    return localeObject;
}

/**
 * Creates or updates a Klarna payments session through Klarna API
 *
 * @return {Object} Last API call's response; on error - null
 */
function createOrUpdateSession() {
    try {
        if( !empty( session.privacy.KlarnaPaymentsSessionID ) ) {
            var updateResult = updateSession();
            var currentCookies = request.getHttpCookies();
            if ( currentCookies.hasOwnProperty( 'selectedKlarnaPaymentCategory' ) ) {
                session.privacy.SelectedKlarnaPaymentMethod = currentCookies['selectedKlarnaPaymentCategory'].value; // eslint-disable-line dot-notation
            }

            return updateResult;
        }
        return createSession();
    } catch( e ) {
        log.error( 'Error in creating or updating Klarna Payments Session: {0}', e );
        Transaction.wrap( function() {
            session.privacy.KlarnaPaymentsSessionID = null;
            session.privacy.KlarnaPaymentsClientToken = null;
            session.privacy.KlarnaPaymentMethods = null;
            session.privacy.SelectedKlarnaPaymentMethod = null;
        } );

        return null;
    }
}

/**
 * Creates a new Klarna payments session
 *
 * Parts of the Klarna API call's response are saved into
 * the DW user session for later use.
 *
 * @returns {Object} Klarna API call response, or null if error occurs.
 */
function createSession() {
    var createSessionHelper = require( '*/cartridge/scripts/session/klarnaPaymentsCreateSession' );
    var createSessionResponse = createSessionHelper.createSession( BasketMgr.currentBasket, getLocale() );
    return createSessionResponse.response;
}

/**
 * Updates an existing Klarna payments session
 *
 * The current session is updated by using the REST Klarna interface.
 * Then, another GET call is made to retrieve session information and
 * update DW user session.
 *
 * @returns {Object} Response from the GET call.
 */
function updateSession() {
    var updateSessionHelper = require( '*/cartridge/scripts/session/klarnaPaymentsUpdateSession' );
    var updateSessionResponse = updateSessionHelper.updateSession( session.privacy.KlarnaPaymentsSessionID, BasketMgr.getCurrentBasket(), getLocale() );
    if ( updateSessionResponse.success && !empty( updateSessionResponse.response ) ) {
        return updateSessionResponse.response;
    }
    return null;
}

/**
 * Entry point for showing confirmation page after Klarna redirect
 *
 * @return {Object} call call COSummary to show confirmation
 */
function confirmation() {
    var order = OrderMgr.getOrder( session.privacy.OrderNo );
    var COSummary = require( '*/cartridge/controllers/COSummary.js' );
    return COSummary.ShowConfirmation( order );
}

/**
 * Entry point for notifications on pending orders
 *
 * @return {void}
 */
function notification() {
    var localeObject = getLocale();
    var FRAUD_STATUS_MAP = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).FRAUD_STATUS_MAP;

    var klarnaPaymentsFraudDecisionObject = JSON.parse( request.httpParameterMap.requestBodyAsString );
    var klarnaPaymentsOrderID = klarnaPaymentsFraudDecisionObject.order_id;
    var klarnaPaymentsFraudDecision = klarnaPaymentsFraudDecisionObject.event_type;

    var klarnaPaymentsGetOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsGetOrder' );
    var klarnaOrder = klarnaPaymentsGetOrderHelper.getKlarnaOrder( klarnaPaymentsOrderID , localeObject );
    if ( klarnaOrder && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] && FRAUD_STATUS_MAP[klarnaOrder.fraud_status] === klarnaPaymentsFraudDecision ) {
        var order = OrderMgr.queryOrder( "custom.kpOrderID ={0}", klarnaPaymentsOrderID );
        if( empty( order ) ) {
            return response.setStatus( 200 );
        }
        Transaction.wrap( function() {
            order.getPaymentInstruments( "Klarna" )[0].paymentTransaction.custom.kpFraudStatus = klarnaPaymentsFraudDecision;
        } );
        if( klarnaPaymentsFraudDecision === 'FRAUD_RISK_ACCEPTED' ) {
            if ( order.custom.kpIsVCN ) {
                var isSettlementCreated = _handleVCNSettlement( order, klarnaPaymentsOrderID, localeObject );
                if ( isSettlementCreated ) {
                    //Plug here your Credit Card Processor
                    var authObj = require( '*/cartridge/scripts/payment/processor/BASIC_CREDIT' ).Authorize( {'OrderNo':order.getOrderNo(),'PaymentInstrument': order.getPaymentInstruments( "Klarna" )[0]} );
                    if( authObj.error ) {
                        Transaction.wrap( function() {
                            OrderMgr.failOrder( order );
                        } );
                        return response.setStatus( 200 );
                    }
                } else {
                    var klarnaPaymentsCancelOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCancelOrder' );
                    klarnaPaymentsCancelOrderHelper.cancelOrder( localeObject, order );
                    Transaction.wrap( function() {
                        OrderMgr.failOrder( order );
                    } );
                    return response.setStatus( 200 );
                }
            }
            placeOrder( order, klarnaPaymentsOrderID, localeObject );

        } else {
            Transaction.wrap( function() {
                OrderMgr.failOrder( order );
            } );
        }
    }
    return response.setStatus( 200 );
}

/**
 * Place an order using OrderMgr. If order is placed successfully,
 * its status will be set as confirmed, and export status set to ready.
 *
 * @param {dw.order.Order}             order                     SCC order object
 * @param {string}                     klarnaPaymentsOrderID     Klarna Payments Order ID
 * @param {dw.object.CustomObject}     localeObject             Klarna Payments locale Object
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
        var setOrderStatusHelper = require( '*/cartridge/scripts/checkout/setOrderStatus' );
        setOrderStatusHelper.updateOrderStatus( order );
    } );

    if ( !order.custom.kpIsVCN ) {
        try {
            var autoCaptureEnabled = Site.getCurrent().getCustomPreferenceValue( 'kpAutoCapture' );

            if ( autoCaptureEnabled ) {
                Transaction.wrap( function() {
                    var klarnaPaymentsCaptureOrderHelper = require( '*/cartridge/scripts/order/klarnaPaymentsCaptureOrder' );
                    klarnaPaymentsCaptureOrderHelper.handleAutoCapture( order, klarnaPaymentsOrderID, localeObject );
                } );
            }
        } catch ( e ) {
            log.error( 'Order could not be placed: {0}', e.message + e.stack );
        }
    }
}

/**
 * Redirect the customer to the Klrana Payments redirect_url.
 * The reason for this redirect is to allow Klarna to recognize the customer's device in future interactions.
 *
 * @return {void}
 */
function redirect() {
    Transaction.wrap( function() {
        session.privacy.KlarnaPaymentsSessionID = null;
        session.privacy.KlarnaPaymentsClientToken = null;
        session.privacy.KlarnaPaymentMethods = null;
        session.privacy.SelectedKlarnaPaymentMethod = null;
    } );

    if( !empty( session.privacy.KlarnaPaymentsRedirectURL ) ) {
        response.redirect( session.privacy.KlarnaPaymentsRedirectURL );
    }
}

/**
 * Place order with KlarnaPaymentsFraudStatus === 'PENDING'
 * set the export status to EXPORT_STATUS_NOTEXPORTED, set the confirmation status to NOTCONFIRMED, set the payment status to NOT PAID
 * @param {dw.order.Order} order SCC order object
 *
 * @return {void}
 */
function pendingOrder( order ) {
    var pendingOrderHelper = require( '*/cartridge/scripts/checkout/setPendingOrderStatus' );
    pendingOrderHelper.updatePendingOrderStatus( order );
}

/**
 * Clear Klarna Payments session and token from current session
 *
 * @return {void}
 */
function clearSession() {
    Transaction.wrap( function() {
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
function saveAuth() {
    // Cancel any previous authorizations
    // cancelAuthorization();

    Transaction.wrap( function() {
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
    var klarnaCancelAuthorizationHelper = require( '*/cartridge/scripts/klarnaPaymentsCancelAuthorization' );
    return klarnaCancelAuthorizationHelper.cancelAuthorization( klarnaAuthorizationToken, getLocale() );
}

/**
 * Display the Klarna Info Page
 * @return {void}
 */
function infoPage() {
    var app = require( '*/cartridge/scripts/app' );
    app.getView().render( 'klarnapayments/klarnainfopage' );
}

/**
 * Function to select the payment method
 *
 * @return {Object} JSON containing error status and update summary
 */
function selectPaymentMethod() {
    var app = require( '*/cartridge/scripts/app' );
    var responseUtils = require( '*/cartridge/scripts/util/Response' );
    var cart = app.getModel( 'Cart' ).get();
    var paymentMethodID = app.getForm( 'billing' ).object.paymentMethods.selectedPaymentMethodID.value;
    var paymentMethod = PaymentMgr.getPaymentMethod( paymentMethodID );
    var processor = paymentMethod ? paymentMethod.getPaymentProcessor() : null;
    var result = null;

    if ( !cart || empty( paymentMethodID ) || !processor ) {
        responseUtils.renderJSON( {
            error: true
        } );
        return;
    }

    var PAYMENT_METHOD = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).PAYMENT_METHOD;
    if ( paymentMethodID === PAYMENT_METHOD ) {
        result = app.getModel( 'PaymentProcessor' ).handle( cart.object, paymentMethodID );

        if ( result.error ) {
            responseUtils.renderJSON( {
                error: true
            } );
            return;
        }
    } else {
        // To handle Credit Cards we need to receive the card details, which are unavailable with just clicking on tabs.
        // In this case we will remove the Klarna payment instrument in order to remove any specific payment promotions
        // Update this logic here if necessary
        Transaction.wrap( function() {
            var paymentInstrs = cart.getPaymentInstruments( PAYMENT_METHOD );
            var iter = paymentInstrs.iterator();

            while( iter.hasNext() ) {
                cart.removePaymentInstrument( iter.next() );
            }
        } );
    }

    var currentBasketTotal = cart.getTotalGrossPrice().getValue();

    Transaction.wrap( function() {
        cart.calculate();
    } );

    var newBasketTotal = cart.getTotalGrossPrice().getValue();

    if ( currentBasketTotal !== newBasketTotal && paymentMethodID === PAYMENT_METHOD ) {
        result = createOrUpdateSession();

        if ( empty( result ) ) {
            responseUtils.renderJSON( {
                error: true
            } );
            return;
        }
    }

    responseUtils.renderJSON( {
        error: false,
        updateSummary: currentBasketTotal !== newBasketTotal
    } );
}

/*
 * Module exports
 */

/* Web exposed methods */

/** Creates or updates a Klarna payments session through Klarna API */
exports.RefreshSession = guard.ensure( ['https'], createOrUpdateSession );
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
/** Display the Klarna Info page */
exports.InfoPage = guard.ensure( ['get'], infoPage );
/** Saves the selected payment method */
exports.SelectPaymentMethod = guard.ensure( ['post'], selectPaymentMethod );

/*
 * Local methods
 */
exports.Handle = handle;
exports.Authorize = authorize;
exports.GetLocale = getLocale;
exports.CreateOrUpdateSession = createOrUpdateSession;
exports.Redirect = redirect;
exports.PendingOrder = pendingOrder;
exports.CancelAuthorization = cancelAuthorization;
