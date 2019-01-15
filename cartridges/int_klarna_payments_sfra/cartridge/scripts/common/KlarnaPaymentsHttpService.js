/* globals empty */

var Logger = require('dw/system/Logger');
var ServiceRegistry = require('dw/svc/ServiceRegistry');
var StringUtils = require('dw/util/StringUtils');
var Site = require('dw/system/Site');
var Resource = require('dw/web/Resource');

function KlarnaPaymentsHttpService() {
    this.logger = Logger.getLogger('RequestTrace');
    this.lastStatusCode = 200;
}

KlarnaPaymentsHttpService.prototype.getLastStatusCode = function () {
    return this.lastStatusCode;
};

KlarnaPaymentsHttpService.prototype.call = function (urlPath, httpVerb, credentialID, requestBody) {
    var serviceID = Site.getCurrent().getCustomPreferenceValue('kpServiceName');
    ServiceRegistry.configure(serviceID, {
        createRequest: function (svc, sRequestBody) {
            return JSON.stringify(sRequestBody);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });

    var service = ServiceRegistry.get(serviceID);
    service.setCredentialID(credentialID);
    service.URL += urlPath;
    service.addHeader('Content-Type', 'application/json');
    service.addHeader('Accept', 'application/json');

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
        return JSON.parse(jsonResponse);
    }

    return result.status;
};

KlarnaPaymentsHttpService.prototype.isValidHttpVerb = function (httpVerb) {
    var validHttpVerbs = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'];

    if (validHttpVerbs.indexOf(httpVerb) !== -1) {
        return true;
    }

    throw new Error('Not valid HTTP verb defined - ' + httpVerb);
};

KlarnaPaymentsHttpService.prototype.detectErrorResponse = function (result, httpVerb, requestUrl, requestBody) {
    if (empty(result)) {
        this.logger.error('result was empty');
        throw new Error(this.getErrorResponse('default'));
    } else if (result.error !== 0 || result.status === 'ERROR' || result.status === 'SERVICE_UNAVAILABLE') {
        this.logErrorResponse(result, requestUrl, requestBody);
        throw new Error(result.errorMessage);
    }
};

KlarnaPaymentsHttpService.prototype.getErrorResponse = function () {
    return Resource.msg('apierror.flow.default', 'klarnapayments', null);
};

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
