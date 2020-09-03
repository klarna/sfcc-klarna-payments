/* globals empty */

/**
 * Klarna Payments HTTP service wrapper
 *
 * Thin wrapper around service registry to handle debug logging
 * of responses from Klarna API service calls.
 *
 */

var Logger = require('dw/system/Logger');
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var StringUtils = require('dw/util/StringUtils');
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');

/**
 * @constructor
 */
function KlarnaPaymentsHttpService() {
    this.logger = Logger.getLogger('RequestTrace');
    this.lastStatusCode = 200;
}

/**
 * Returns the status code of the last API service call.
 * @returns {int} last status code.
 */
KlarnaPaymentsHttpService.prototype.getLastStatusCode = function () {
    return this.lastStatusCode;
};

/**
 * Executes an HTTP request to Klarna API
 *
 * @param {string} urlPath - URL path.
 * @param {string} httpVerb - a valid HTTP verb.
 * @param {string} credentialID - DW service credentials ID.
 * @param {Object} requestBody - optional, JSON body.
 * @returns {string} Parsed JSON response; if not available - response status code.
 */
KlarnaPaymentsHttpService.prototype.call = function (urlPath, httpVerb, credentialID, requestBody) {
    var serviceID = Site.getCurrent().getCustomPreferenceValue('kpServiceName');
    var service = LocalServiceRegistry.createService(serviceID, {
        createRequest: function (svc, sRequestBody) {
            return JSON.stringify(sRequestBody);
        },
        parseResponse: function (svc, client) {
            return client;
        },
        filterLogMessage: function (msg) {
            return msg;
        }
    });

    service.setCredentialID(credentialID);
    service.URL += urlPath;
    service.addHeader('Content-Type', 'application/json');
    service.addHeader('Accept', 'application/json');
    service.addHeader('User-Agent', 'SFCC SFRA Klarna Payments 19.1.6');

    if (!empty(httpVerb) && this.isValidHttpVerb(httpVerb)) {
        service.setRequestMethod(httpVerb);
    }

    var result;
    try {
        if (empty(requestBody)) {
            result = service.call();
        } else {
            result = service.call(requestBody);
        }

        this.lastStatusCode = result.error;
    } catch (ex) {
        var exception = ex;
        this.logger.error(exception.message);
    }

    this.logResponseData(urlPath, httpVerb, requestBody, result);
    this.detectErrorResponse(result, httpVerb, service.URL, requestBody);

    if (!empty(result.object.text)) {
        var jsonResponse = result.object.text.replace(/\r?\n|\r/g, ' ');
        var responseObject = JSON.parse(jsonResponse);

        if (responseObject.external && !responseObject.external.approved) {
            throw new Error('Klarna service error');
        } else {
            return responseObject;
        }
    }

    return result.status;
};

/**
 * Validates an input against the HTTP verbs.
 *
 * @param {string} httpVerb - one of POST, GET, PUT, DELETE.
 * @returns {boolean} - true, if the passed input is a valid HTTP verb.
 */
KlarnaPaymentsHttpService.prototype.isValidHttpVerb = function (httpVerb) {
    var validHttpVerbs = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'];

    if (validHttpVerbs.indexOf(httpVerb) !== -1) {
        return true;
    }

    throw new Error('Not valid HTTP verb defined - ' + httpVerb);
};

/**
 * Transforms an error response from Klarna API into an Error exception.
 *
 * @param {Object} result - Response object.
 * @param {string} httpVerb - a valid HTTP verb.
 * @param {string} requestUrl - The URL used to make the request.
 * @param {JSON} requestBody - optional, JSON body.
 */
KlarnaPaymentsHttpService.prototype.detectErrorResponse = function (result, httpVerb, requestUrl, requestBody) {
    if (empty(result)) {
        this.logger.error('result was empty');
        throw new Error(this.getErrorResponse('default'));
    } else if (result.error !== 0 || result.status === 'ERROR' || result.status === 'SERVICE_UNAVAILABLE') {
        this.logErrorResponse(result, requestUrl, requestBody);
        throw new Error(result.errorMessage);
    }
};

/**
 * Returns a default error response message.
 *
 * @returns {string} error message.
 */
KlarnaPaymentsHttpService.prototype.getErrorResponse = function () {
    return Resource.msg('apierror.flow.default', 'klarnapayments', null);
};

/**
 * Log debug information regarding an error response.
 *
 * @param {string} result - Result from last service call.
 * @param {string} requestUrl - Request URL of the last service call.
 * @param {Object} requestBody - Request body of the last service call.
 */
KlarnaPaymentsHttpService.prototype.logErrorResponse = function (result, requestUrl, requestBody) {
    var content = 'result.error=[' + result.error;
    content += '], result.status=[' + result.status;
    content += '], result.errorMessage=[' + result.errorMessage + ']';

    if (!empty(result.object) && !empty(result.object.text)) {
        content += '], result.object.text=[' + result.object.text + ']';
    }

    if (!empty(requestUrl)) {
        content += ', requestUrl=[' + requestUrl + ']';
    }

    if (!empty(requestBody)) {
        content += ', requestBody=[' + JSON.stringify(requestBody) + ']';
    }

    this.logger.error(content);
};

/**
 * Log debug response data for successful API calls.
 *
 * @param {string} urlPath - URL path from last service call.
 * @param {string} httpVerb - valid HTTP verb from last service call.
 * @param {Object} requestBody - Request body of the last service call.
 * @param {Object} result - Response object.
 */
KlarnaPaymentsHttpService.prototype.logResponseData = function (urlPath, httpVerb, requestBody, result) {
    try {
        var message = '';
        var requestBodyJson = JSON.stringify(requestBody);

        if (!empty(result.object) && !empty(result.object.text)) {
            message = StringUtils.format('Response for request urlPath={0}, httpVerb={1}, requestBody=[{2}], responseBody=[{3}]',
                        urlPath,
                        httpVerb,
                        requestBodyJson,
                        result.object.text);
        } else {
            message = StringUtils.format('Response for EMPTY request urlPath={0}, httpVerb={1}, requestBody=[{2}]',
                        urlPath,
                        httpVerb,
                        requestBodyJson);
        }

        this.logger.info(message);
    } catch (e) {
        var exception = e;
        this.logger.error(exception);
    }
};

module.exports = KlarnaPaymentsHttpService;
