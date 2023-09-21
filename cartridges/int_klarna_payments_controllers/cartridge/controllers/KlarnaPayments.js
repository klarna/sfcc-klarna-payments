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
var app = require( '*/cartridge/scripts/app' );
var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var KlarnaAdditionalLogging = require( '*/cartridge/scripts/util/klarnaAdditionalLogging' );

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
                KlarnaAdditionalLogging.writeLog( args.Order, args.Order.custom.kpSessionId, 'KlarnaPayments.authorize()', 'Error on handleAutoCapture(). Error:'+ JSON.stringify( e ) );
                return { error: true };
            }
        }
    }

    Transaction.wrap( function() {
        paymentInstrument.paymentTransaction.transactionID = session.privacy.KlarnaPaymentsOrderID;
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
        session.privacy.OrderNo = orderNo;
        args.Order.custom.klarna_oms__kpOrderID = session.privacy.KlarnaPaymentsOrderID;
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
    var basket = BasketMgr.getCurrentBasket();
    if ( empty( basket ) ) {
        return null;
    }

    try {
        if( !empty( basket.custom.kpSessionId ) ) {
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
        KlarnaAdditionalLogging.writeLog( basket, basket.custom.kpSessionId, 'KlarnaPayments.createOrUpdateSession()', 'Error in creating or updating Klarna Payments Session, e:'+ JSON.stringify( e ) );

        KlarnaHelper.clearSessionRef( basket );
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
    var basket = BasketMgr.getCurrentBasket();
    if ( empty( basket ) ) {
        return null;
    }

    var createSessionHelper = require( '*/cartridge/scripts/session/klarnaPaymentsCreateSession' );
    var createSessionResponse = createSessionHelper.createSession( basket, getLocale() );

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
    var basket = BasketMgr.getCurrentBasket();
    if ( empty ( basket ) ) {
        return null;
    }

    var updateSessionHelper = require( '*/cartridge/scripts/session/klarnaPaymentsUpdateSession' );
    
    var updateSessionResponse = updateSessionHelper.updateSession( basket.custom.kpSessionId, basket, getLocale() );

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

    //remove kpClientToken from order
    Transaction.wrap( function() {
        if ( order && !empty( order.custom.kpClientToken ) ) {
            order.custom.kpClientToken = null;
        }
    } );

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
        var order = OrderMgr.queryOrder( "custom.klarna_oms__kpOrderID ={0}", klarnaPaymentsOrderID );
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
            KlarnaAdditionalLogging.writeLog( order, order.custom.kpSessionId, 'KlarnaPayments.placeOrder()', 'Order could not be placed. Error:'+ JSON.stringify( e ) );
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
        session.privacy.KlarnaPaymentMethods = null;
        session.privacy.SelectedKlarnaPaymentMethod = null;
        session.privacy.KlarnaExpressCategory = null;
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
    var basket = BasketMgr.getCurrentBasket();
    KlarnaHelper.clearSessionRef( basket );
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
    app.getView().render( 'klarnapayments/klarnainfopage' );
}

/**
 * Function to select the payment method
 *
 * @return {Object} JSON containing error status and update summary
 */
function selectPaymentMethod() {
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

    var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
    
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

    if ( paymentMethodID === PAYMENT_METHOD ) {
        
        if ( cart.object.defaultShipment.shippingMethod === null ) {
            var URLUtils = require('dw/web/URLUtils');
            responseUtils.renderJSON( {
                error: true,
                cartError: true,
                redirectUrl: URLUtils.url('Cart-Show').toString()
            } );
            return;
        }
        
        // Update Klarna session details if we have selected Klarna option,
        // before placing order in order to get the correct order number
        // including taxation and discount.
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

function expressCheckout() {
    var URLUtils = require( 'dw/web/URLUtils' );
    var PAYMENT_METHOD = KlarnaHelper.getPaymentMethod();
    
    var cart = app.getModel( 'Cart' ).get();
    var expressForm = app.getForm( 'klarnaexpresscheckout' ).object;
    var klarnaDetails = KlarnaHelper.getExpressFormDetails( expressForm );
    var step = 'COBilling-Start';

    if ( !cart ) {
        response.redirect( URLUtils.https( 'Cart-Show' ) );
        return;
    }

    // Clear all payment forms before we handle KEB
    app.getForm( 'billing' ).object.paymentMethods.clearFormElement();

    // Set billing address & email
    KlarnaHelper.setExpressBilling( cart, klarnaDetails );

    // We only have gift certificates in the basket
    if ( cart.getProductLineItems().size() === 0 && cart.getGiftCertificateLineItems().size() > 0 ) {
        handleExpressRedirect( cart, PAYMENT_METHOD );
        return;
    }

    // Prepare shipments info
    app.getController( 'COShipping' ).PrepareShipments();

    var physicalShipments = cart.getPhysicalShipments();
    var hasMultipleShipments = Site.getCurrent().getCustomPreferenceValue( 'enableMultiShipping' ) && physicalShipments && physicalShipments.size() > 1;

    var hasShippingMethod = true;
    var shipments = cart.getShipments();
    for ( var i = 0; i < shipments.length; i++ ) {
        var shipment = shipments[i];

        // Do not process gift certificate shipments as part of mixed orders
        // Do not process shipment without goods as well
        if ( shipment.getGiftCertificateLineItems().size() > 0 ) {
            continue;
        }

        // Fix issue with empty default shipment with null shipping address
        // validation in COPlaceOrder-Start
        if ( shipment.default && !shipment.shippingAddress && shipment.getProductLineItems().size() === 0 ) {
            Transaction.wrap( function() {
                cart.createShipmentShippingAddress( shipment.getID() );
            } );
            continue;
        }

        // Pre-populate address details if not already present
        // Don't update it on store pickup shipments as this is the store address
        if ( ( !shipment.shippingAddress || !shipment.shippingAddress.address1 ) && empty( shipment.custom.fromStoreId ) ) {
            KlarnaHelper.setExpressShipping( shipment, klarnaDetails );
        }

        var applicableShippingMethods = KlarnaHelper.filterApplicableShippingMethods( shipment, shipment.shippingAddress );
        var hasShippingMethodSet = !!shipment.shippingMethod;

        // Check if the selected method is still applicable
        if ( hasShippingMethodSet ) {
            hasShippingMethodSet = applicableShippingMethods.contains( shipment.shippingMethod );
        }

        // If we have no shipping method or it's no longer applicable - try to select the first one
        if ( !hasShippingMethodSet ) {
            var shippingMethod = applicableShippingMethods.iterator().next();
            if ( shippingMethod ) {
                Transaction.wrap( function() {
                    cart.updateShipmentShippingMethod( shipment.getID(), shippingMethod.getID(), null, applicableShippingMethods );
                } );
            } else {
                hasShippingMethod = false;
            }
        }
    }

    Transaction.wrap( function() {
        cart.calculate();
    } );

    if ( !hasShippingMethod ) {
        if ( hasMultipleShipments ) {
            response.redirect( URLUtils.https( 'COShippingMultiple-Start' ) );
            return;
        }

        response.redirect( URLUtils.https( 'COShipping-Start' ) );
        return;
    }

    session.forms.singleshipping.fulfilled.value = true;

    handleExpressRedirect( cart, PAYMENT_METHOD );
    return;
}

function handleExpressRedirect( cart, paymentMethodId ) {
    var URLUtils = require( 'dw/web/URLUtils' );
    var KlarnaOSM = require( '*/cartridge/scripts/marketing/klarnaOSM' );
    var EXPRESS_CATEGORY = KlarnaOSM.getExpressButtonCategory();

    session.privacy.KlarnaExpressCategory = EXPRESS_CATEGORY;
    session.forms.billing.paymentMethods.selectedPaymentMethodID.value = paymentMethodId;

    // Handle the selection of this payment method - calculate if any payment promotions are available
    var result = app.getModel( 'PaymentProcessor' ).handle( cart.object, paymentMethodId );

    Transaction.wrap( function() {
        cart.calculate();
    } );

    // Re-direct to cart if we have any processor handling issues
    if ( result.error ) {
        response.redirect( URLUtils.https( 'Cart-Show' ) );
    }

    response.redirect( URLUtils.https( 'COBilling-Start' ) );
}

function writeLog() {
    var basket = BasketMgr.getCurrentBasket();
    var storeFrontResponse = request.httpParameterMap.responseFromKlarna.value;
    var actionName = request.httpParameterMap.actionName.value;
    var message = request.httpParameterMap.message.value;

    KlarnaAdditionalLogging.writeLog(basket, basket.custom.kpSessionId, actionName, message + ' Response Object:' + storeFrontResponse);

    return;
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
/** Triggers the express checkout flow */
exports.ExpressCheckout = guard.ensure( ['post'], expressCheckout );
/** Triggers the additional loging */
exports.WriteLog = guard.ensure( ['post'], writeLog );

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
