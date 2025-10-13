'use strict';

var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Transaction = require( 'dw/system/Transaction' );
var URLUtils = require( 'dw/web/URLUtils' );
var crypto = require( 'dw/crypto' );
var Encoding = require( 'dw/crypto/Encoding' );

var KlarnaWebhook = {
    httpService : require( '*/cartridge/scripts/common/klarnaWebhookHttpService' ),
    apiContext : require( '*/cartridge/scripts/common/klarnaPaymentsApiContext' )
};

/**
 * Calls Klarna Webhook Service to create a new signing key.
 *
 * @returns {dw.svc.Result} Service response containing the signing key details from Klarna.
 */
function createSigningKey() {
    var klarnaWebhookHttpService = new KlarnaWebhook.httpService();
    var klarnaApiContext = new KlarnaWebhook.apiContext();
    var requestUrl = klarnaApiContext.getFlowApiUrls().get( 'createSigningKey' );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'klarnaWebhook' );
    var response = klarnaWebhookHttpService.call( serviceID, requestUrl, 'POST', 'klarna.http.webhook', null );
    return response;
}

/**
 * Retrieves the most recently created Klarna signing key custom object.
 *
 * @returns {(dw.object.CustomObject|boolean)} Latest signing key custom object, or false if none exist.
 */
function getExistingSigningKey() {
    var iterator = CustomObjectMgr.queryCustomObjects( 'KlarnaSigningKey', '', 'creationDate desc' );
    if ( !iterator.hasNext() ) {
        return false;
    }
    var signingKeyObj = iterator.next();
    return signingKeyObj;
}

/**
 * Saves a Klarna signing key object into custom object of type "KlarnaSigningKey".
 *
 * @param {Object} signingKeyObj - Signing key details returned by Klarna (must contain id, key, and created date).
 * @returns {(dw.object.CustomObject|null)} The created custom object, or null if input is invalid.
 */
function saveSigningKey( signingKeyObj ) {
    var signingKeyId = signingKeyObj ? signingKeyObj.signing_key_id : null;
    var signingKey = signingKeyObj ? signingKeyObj.signing_key : null;
    var createdDate = signingKeyObj ? signingKeyObj.created_at : null;
    if ( !signingKeyId || !signingKey || !createdDate ) {
        return null;
    }
    var signingKeyObject = null;
    Transaction.wrap( function() {
        signingKeyObject = CustomObjectMgr.createCustomObject( 'KlarnaSigningKey', signingKeyId );
        signingKeyObject.custom.createdDate = createdDate;
        signingKeyObject.custom.signingKey = signingKey;
    } );
    return signingKeyObject;
}

/**
 * Checks if a Klarna webhook already exists for the given signing key ID.
 *
 * @param {string} signingKeyId - The signing key ID to check for.
 * @returns {(Object|boolean)} The existing webhook object if found, otherwise false.
 */
function checkIfWebhookExists( signingKeyId ) {
    var allWebhooks = listAllWebhooks();
    var existingWebhook = false;
    if ( allWebhooks && allWebhooks.webhooks && allWebhooks.webhooks.length > 0 ) {
        for ( var i = 0; i < allWebhooks.webhooks.length; i++ ) {
            if ( allWebhooks.webhooks[i].signing_key_id === signingKeyId ) {
                existingWebhook = allWebhooks.webhooks[i];
                break;
            }
        }
    }
    return existingWebhook;
}

/**
 * Fetches all registered Klarna webhooks via the Klarna Webhook Service.
 *
 * @returns {dw.svc.Result} Service response containing all webhook data.
 */
function listAllWebhooks() {
    var klarnaWebhookHttpService = new KlarnaWebhook.httpService();
    var klarnaApiContext = new KlarnaWebhook.apiContext();
    var requestUrl = klarnaApiContext.getFlowApiUrls().get( 'klarnaWebhook' );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'klarnaWebhook' );
    var response = klarnaWebhookHttpService.call( serviceID, requestUrl, 'GET', 'klarna.http.webhook', null );
    return response;
}

/**
 * Processes a string of event types into an array of trimmed, lowercase values.
 * Splits on commas or newlines.
 *
 * @param {string} eventTypes - A comma or newline separated list of event types.
 * @returns {string[]} An array of processed event types.
 */
function processEventTypes( eventTypes ) {
    var processedEventTypes = [];
    if( eventTypes ) {
        var rawEventTypes = eventTypes.split( /[\n,]+/ );
        for ( var i = 0; i < rawEventTypes.length; i++ ) {
            var e = rawEventTypes[i];
            if ( e && e.trim().length > 0 ) {
                var formatted = e.trim().toLowerCase();
                processedEventTypes.push( formatted );
            }
        }
    }
    return processedEventTypes;
}

/**
 * Creates a new Klarna webhook.
 *
 * @param {Object} data - Data required to create the webhook.
 * @returns {dw.svc.Result} The service call response.
 */
function createWebhook( data ) {
    var klarnaWebhookHttpService = new KlarnaWebhook.httpService();
    var klarnaApiContext = new KlarnaWebhook.apiContext();
    var requestUrl = klarnaApiContext.getFlowApiUrls().get( 'klarnaWebhook' );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'klarnaWebhook' );
    var eventTypes = data && data.eventTypes ? data.eventTypes : null;
    var signingKeyId = data && data.signingKeyId ? data.signingKeyId : null;

    var requestBody = {
        url: URLUtils.https( 'KlarnaPayments-WebhookNotification' ).toString(),
        event_types: eventTypes,
        event_version: 'v2',
        signing_key_id: signingKeyId,
        status: 'ENABLED'
    }
    var response = klarnaWebhookHttpService.call( serviceID, requestUrl, 'POST', 'klarna.http.webhook', requestBody );
    return response;
}

/**
 * Checks whether the provided event types already exist in the webhook.
 *
 * @param {Object} data - Input data containing event types and an existing webhook.
 * @returns {boolean} True if all event types match, false otherwise.
 */
function checkIfEventTypesPresent( data ) {
    var eventTypes = data && data.eventTypes ? data.eventTypes : null;
    var webhook = data && data.existingWebhook ? data.existingWebhook : null;
    var existingEventTypes = webhook && webhook.event_types ? webhook.event_types : null;

    if ( webhook && eventTypes && eventTypes.length > 0 && existingEventTypes ) {
        if ( eventTypes.length !== existingEventTypes.length ) {
            return false;
        }
        for ( var i = 0; i < eventTypes.length; i++ ) {
            var e = eventTypes[i];
            if ( existingEventTypes.indexOf( e ) === -1 ) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Updates an existing Klarna webhook with new event types.
 *
 * @param {Object} data - Data containing updated webhook info.
 * @returns {dw.svc.Result} The service call response.
 */
function updateWebhook( data ) {
    var klarnaWebhookHttpService = new KlarnaWebhook.httpService();
    var klarnaApiContext = new KlarnaWebhook.apiContext();

    var eventTypes = data && data.eventTypes ? data.eventTypes : null;
    var webhook = data && data.existingWebhook ? data.existingWebhook : null;
    var webhookId = webhook && webhook.webhook_id ? webhook.webhook_id : null;
    var signingKeyId = webhook && webhook.signing_key_id ? webhook.signing_key_id : null;

    var requestUrl = dw.util.StringUtils.format( klarnaApiContext.getFlowApiUrls().get( 'updateKlarnaWebhook' ), webhookId );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'klarnaWebhook' );

    var requestBody = {
        url: URLUtils.https( 'Webhook-Notification' ).toString(),
        event_types: eventTypes,
        signing_key_id: signingKeyId,
        status: 'ENABLED'
    };
    var response = klarnaWebhookHttpService.call( serviceID, requestUrl, 'PATCH', 'klarna.http.webhook', requestBody );
    return response;
}

/**
 * Creates a Klarna single-step payment request.
 *
 * @param {Object} requestBody - The request payload to be sent to Klarna API.
 * @returns {dw.svc.Result} The service call response from Klarna.
 */
function createPaymentRequest( requestBody ) {
    var klarnaWebhookHttpService = new KlarnaWebhook.httpService();
    var klarnaApiContext = new KlarnaWebhook.apiContext();
    var requestUrl = klarnaApiContext.getFlowApiUrls().get( 'singleStepPayment' );
    var serviceID = klarnaApiContext.getFlowApiIds().get( 'klarnaWebhook' );
    var response = klarnaWebhookHttpService.call( serviceID, requestUrl, 'POST', 'klarna.http.webhook', requestBody );
    return response;
}

/**
 * Validates a webhook signature from Klarna using the latest signing key.
 *
 * @param {Object} data - Input data for validation.
 * @returns {boolean} True if the computed HMAC matches the Klarna signature, false otherwise.
 */
function validateWebhookSignature( data ) {
    var requestBody = data && data.requestBody ? data.requestBody : '';
    var klarnaSignature = data && data.klarnaSignature ? data.klarnaSignature : '';

    var iterator = CustomObjectMgr.queryCustomObjects( 'KlarnaSigningKey', '', 'creationDate desc' );
    var signingKeyObj = iterator ? iterator.next() : null;
    var signingKey = signingKeyObj ? signingKeyObj.custom.signingKey : '';

    var mac = new crypto.Mac( crypto.Mac.HMAC_SHA_256 );
    var hmacBytes = mac.digest( requestBody, signingKey );
    var computedSignature = Encoding.toHex( hmacBytes );

    if ( computedSignature === klarnaSignature ) {
        return true;
    }
    return false;
}

/**
 * Saves a webhook notification payload in a custom object for later processing.
 *
 * @param {Object} data Notification data.
 * @returns {Object} Object containing the created notification custom object, or null if not saved.
 */
function saveWebhookNotification( data ) {
    var requestData = data && data.requestData ? data.requestData : null;
    var payload = requestData ? requestData.payload : null;
    var paymentRequestId = payload ? payload.payment_request_id : null;
    var notificationObj = null;
    if ( paymentRequestId ) {
        Transaction.wrap( function() {
            notificationObj = CustomObjectMgr.createCustomObject( 'KlarnaWebhookNotification', paymentRequestId );
            notificationObj.custom.notificationLog = JSON.stringify( requestData );
            notificationObj.custom.notificationStatus = 'PROCESS'
        } );
    }
    return {
        notificationObj: notificationObj
    };
}
/**
 * Removes the given custom object
 *
 * @param {dw.object.CustomObject} customObject - The custom object to be removed.
 * @returns {void}
 */
function removeCustomObject( customObject ) {
    Transaction.wrap( function() {
        CustomObjectMgr.remove( customObject );
    } );
}

/**
 * Deletes Klarna webhook notifications that are either:
 * - older than the given number of expiry days, or
 * - have a notificationStatus of "SUCCESS".
 *
 * @param {Object} data - Input data containing configuration for deletion.
 * @param {number} data.expiryDays - Number of days after which notifications are considered expired.
 * @returns {void}
 */
function deleteWebhookNotifications( data ) {
    var expiryDays = data ? data.expiryDays : null;
    var queryString = 'creationDate <= {0} OR custom.notificationStatus = {1}';
    var expiryDate = new Date();
    expiryDate.setDate( expiryDate.getDate() - expiryDays );
    var notifications = CustomObjectMgr.queryCustomObjects( 'KlarnaWebhookNotification', queryString, null, expiryDate, 'SUCCESS' );
    while ( notifications.hasNext() ) {
        var notification = notifications.next();
        removeCustomObject( notification );
    }
}

module.exports = {
    createSigningKey: createSigningKey,
    getExistingSigningKey: getExistingSigningKey,
    saveSigningKey: saveSigningKey,
    checkIfWebhookExists: checkIfWebhookExists,
    createWebhook: createWebhook,
    checkIfEventTypesPresent: checkIfEventTypesPresent,
    updateWebhook: updateWebhook,
    processEventTypes: processEventTypes,
    createPaymentRequest: createPaymentRequest,
    validateWebhookSignature: validateWebhookSignature,
    saveWebhookNotification: saveWebhookNotification,
    deleteWebhookNotifications: deleteWebhookNotifications
};