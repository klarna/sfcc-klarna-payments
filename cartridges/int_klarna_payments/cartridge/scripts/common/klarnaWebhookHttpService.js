'use strict';
var Logger = require( 'dw/system/Logger' );
var LocalServiceRegistry = require( 'dw/svc/LocalServiceRegistry' );
var StringUtils = require( 'dw/util/StringUtils' );
var Resource = require('dw/web/Resource');
var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var SERVICE_HEADER = require( '*/cartridge/scripts/util/klarnaPaymentsConstants' ).SERVICE_HEADER;

/**
 * @constructor
 */
function KlarnaWebhookHttpService() {
    this.logger = Logger.getLogger( 'RequestTrace' );
    this.lastStatusCode = 200;
}

/**
 * Executes an HTTP request to Klarna API
 *
 * @param {string} serviceId - ID of the calling service.
 * @param {string} urlPath - service URL path.
 * @param {string} httpVerb - a valid HTTP verb.
 * @param {string} credentialID - DW service credentials ID.
 * @param {Object} requestBody - optional, JSON body.
 * @returns {string} Parsed JSON response; if not available - response status code.
 */
KlarnaWebhookHttpService.prototype.call = function( serviceId, urlPath, httpVerb, credentialID, requestBody ) {
    var service = LocalServiceRegistry.createService( serviceId, {
        createRequest: function( svc, RequestBody ) {
            return JSON.stringify( RequestBody );
        },
        parseResponse: function( svc, client ) {
            return client;
        },
        filterLogMessage: function( msg ) {
            try {
                return maskPersonalDetails( JSON.parse( msg ) );
            } catch( e ) {
                return msg;
            }
        },
        mockCall: function( svc, client ) {
            return {
                statusCode: 500,
                statusMessage: "ERROR",
                errorText: "MOCK RESPONSE",
                mockResult: true,
                object: null,
                ok: false,
                unavailableReason: null
            };
        }
    } );

    setServiceCredentials( service, credentialID );
    service.URL += urlPath;
    service.addHeader( 'Content-Type', 'application/json' );
    service.addHeader( 'Accept', 'application/json' );
    service.addHeader('User-Agent', SERVICE_HEADER);

    if ( !empty( httpVerb ) && this.isValidHttpVerb( httpVerb ) ) {
        service.setRequestMethod( httpVerb );
    }

    var result;
    try {
        if ( empty( requestBody ) ) {
            result = service.call();
        } else {
            result = service.call( requestBody );
        }

        this.lastStatusCode = result.error;
    } catch ( ex ) {
        var exception = ex;
        this.logger.error( exception.message );
    }

    this.logResponseData( urlPath, httpVerb, requestBody, result );
    this.detectErrorResponse( result, httpVerb, service.URL, requestBody, serviceId );

    if ( !empty( result.object ) && !empty( result.object.text ) ) {
        var jsonResponse = result.object.text.replace( /\r?\n|\r/g, ' ' );
        var responseObject = JSON.parse( jsonResponse );

        if ( responseObject.external && !responseObject.external.approved ) {
            throw new Error( 'Klarna service error' );
        } else {
            return responseObject;
        }
    }

    return result.status;
};

/**
 * Returns a default error response message.
 *
 * @returns {string} error message.
 */
KlarnaWebhookHttpService.prototype.getErrorResponse = function() {
    return Resource.msg( 'apierror.flow.default', 'klarnawebhook', null );
};

/**
 * Log debug information regarding an error response.
 *
 * @param {string} result - Result from last service call.
 * @param {string} requestUrl - Request URL of the last service call.
 * @param {Object} requestBody - Request body of the last service call.
 * @returns {void}
 */
KlarnaWebhookHttpService.prototype.logErrorResponse = function( result, requestUrl, requestBody ) {
    var content = 'result.error=[' + result.error;
    content += '], result.status=[' + result.status;
    content += '], result.errorMessage=[' + result.errorMessage + ']';

    if ( !empty( result.object ) && !empty( result.object.text ) ) {
        content += '], result.object.text=[' + result.object.text + ']';
    }

    if ( !empty( requestUrl ) ) {
        content += ', requestUrl=[' + requestUrl + ']';
    }

    if ( !empty( requestBody ) ) {
        content += ', requestBody=[' + JSON.stringify( requestBody ) + ']';
    }

    this.logger.error( content );
};

/**
 * Transforms an error response from Klarna API into an Error exception.
 *
 * @param {Object} result - Response object.
 * @param {string} httpVerb - a valid HTTP verb.
 * @param {string} requestUrl - The URL used to make the request.
 * @param {JSON} requestBody - optional, JSON body.
 * @param {string} serviceID - ID of the calling service.
 * @returns {void}
 */
KlarnaWebhookHttpService.prototype.detectErrorResponse = function( result, httpVerb, requestUrl, requestBody, serviceID ) {
    if ( empty( result ) ) {
        this.logger.error( 'result was empty' );
        throw new Error( this.getErrorResponse( 'default' ) );
    } else if ( result.error === 404 ) {
        this.logErrorResponse( result, requestUrl, requestBody );
        throw new Error( result );
        //log error response for all 5xx status codes but not fail order
    } else if ( result.error > 499 && result.error < 600 ) {
        this.logErrorResponse( result, requestUrl, requestBody );
        if ( serviceID && serviceID.indexOf( 'createOrder' ) != -1 ) {
            throw new Error( result );
        }
    } else if ( result.error !== 0 || result.status === 'ERROR' || result.status === 'SERVICE_UNAVAILABLE' ) {
        this.logErrorResponse( result, requestUrl, requestBody );
        throw new Error( result.errorMessage );
    }
};

/**
 * Log debug response data for successful API calls.
 *
 * @param {string} urlPath - URL path from last service call.
 * @param {string} httpVerb - valid HTTP verb from last service call.
 * @param {Object} requestBody - Request body of the last service call.
 * @param {Object} result - Response object.
 * @returns {void}
 */
KlarnaWebhookHttpService.prototype.logResponseData = function( urlPath, httpVerb, requestBody, result ) {
    try {
        var message = '';
        var requestBodyJson = maskPersonalDetails( requestBody );

        if ( !empty( result.object ) && !empty( result.object.text ) ) {
            message = StringUtils.format( 'Response for request urlPath={0}, httpVerb={1}, requestBody=[{2}], responseBody=[{3}]',
                urlPath,
                httpVerb,
                requestBodyJson,
                result.object.text );
        } else {
            message = StringUtils.format( 'Response for EMPTY request urlPath={0}, httpVerb={1}, requestBody=[{2}]',
                urlPath,
                httpVerb,
                requestBodyJson );
        }

        this.logger.info( message );
    } catch ( e ) {
        var exception = e;
        this.logger.error( exception );
    }
};

/**
 * Validates an input against the HTTP verbs.
 *
 * @param {string} httpVerb - one of POST, GET, PUT, DELETE.
 * @returns {boolean} - true, if the passed input is a valid HTTP verb.
 */
KlarnaWebhookHttpService.prototype.isValidHttpVerb = function( httpVerb ) {
    var validHttpVerbs = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'];

    if ( validHttpVerbs.indexOf( httpVerb ) !== -1 ) {
        return true;
    }

    throw new Error( 'Not valid HTTP verb defined - ' + httpVerb );
};


/**
 * Function to mask the characters of given text except first and last digit
 *
 * @param {string} text string to mask
 * @return {string} masked text
 */
function maskText( text ) {
    return text.split( '' ).map( function( o, i ) {
        if ( i === 0 || i === ( text.length - 1 ) ) {
            return o;
        }
        return '*';
    } ).join( '' );
}

/**
 * Function to mask email string
 *
 * @param {string} email email to mask
 * @return {string} masked email
 */
function maskEmail( email ) {
    var index = email.lastIndexOf( '@' );
    var prefix = email.substring( 0, index );
    var postfix = email.substring( index );

    var mask = maskText( prefix );

    return mask + postfix;
}

/**
 * Function to mask names
 *
 * @param {string} name name to mask
 * @return {string} masked name
 */
function maskName( name ) {
    var maskedName = '';
    var split = name.split( ' ' );
    for ( var i = 0; i < split.length; i++ ) {
        maskedName += maskText( split[i] );
        maskedName += ' ';
    }
    maskedName = maskedName.trim();
    return maskedName;
}

/**
 * Function to mask personal details from being logged including names and email
 * @param {Object} requestBody request body that needs to be masked
 * @return {Object} request with masked fields
 */
function maskPersonalDetails( requestBody ) {
    var email = '';
    var maskedRequest = requestBody;
    if ( !empty( requestBody ) && !empty( requestBody.billing_address ) && !empty( requestBody.billing_address.email ) ) {
        email = maskEmail( requestBody.billing_address.email );
        maskedRequest.billing_address.email = email;
    }
    if ( !empty( requestBody ) && !empty( requestBody.shipping_address ) && !empty( requestBody.shipping_address.email ) ) {
        email = maskEmail( requestBody.shipping_address.email );
        maskedRequest.shipping_address.email = email;
    }
    if ( !empty( requestBody ) && !empty( requestBody.billing_address ) ) {
        if ( !empty( requestBody.billing_address.given_name ) ) {
            maskedRequest.billing_address.given_name = maskName( requestBody.billing_address.given_name );
        }
        if ( !empty( requestBody.billing_address.family_name ) ) {
            maskedRequest.billing_address.family_name = maskName( requestBody.billing_address.family_name );
        }
    }
    if ( !empty( requestBody ) && !empty( requestBody.shipping_address ) ) {
        if ( !empty( requestBody.shipping_address.given_name ) ) {
            maskedRequest.shipping_address.given_name = maskName( requestBody.shipping_address.given_name );
        }
        if ( !empty( requestBody.shipping_address.family_name ) ) {
            maskedRequest.shipping_address.family_name = maskName( requestBody.shipping_address.family_name );
        }
    }
    if ( !empty( requestBody ) && !empty( requestBody.customer ) && !empty( requestBody.customer.klarna_access_token ) ) {
        maskedRequest.customer.klarna_access_token = maskName( requestBody.customer.klarna_access_token );
    }
    return JSON.stringify( maskedRequest );
}

function setServiceCredentials( service, credentialID ) {
    var klarnaConfigs = KlarnaHelper.getKlarnaWebhookServiceCredentials();
    if ( !klarnaConfigs.useServiceCredentials ) {
        var Encoding = require( 'dw/crypto/Encoding' );
        var Bytes = require( 'dw/util/Bytes' );
        var password = klarnaConfigs.apiPassword;
        var username = klarnaConfigs.apiUsername;
        var basicToken = Encoding.toBase64( new Bytes( username + ':' + password ) );

        service.addHeader( 'Authorization', 'Basic ' + basicToken );
        service.URL = klarnaConfigs.apiURL;
    } else {
        service.setCredentialID( credentialID );
    }
}


module.exports = KlarnaWebhookHttpService;