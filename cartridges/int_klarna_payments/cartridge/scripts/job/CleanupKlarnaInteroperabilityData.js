'use strict';

/**
 * Script to cleanup expired Klarna interoperability data from custom objects
 * This job should run daily to remove records older than 24 hours
 */

var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger');

/**
 * Function called by job to clean up expired interoperability data
 * @param {Object} parameters Job parameters
 * @return {dw.system.Status} execution status
 */
exports.execute = function (parameters) {
    try {
        var siteID = dw.system.Site.getCurrent().getID();
        var KlarnaInteroperabilityDataManager = require('*/cartridge/scripts/common/klarnaInteroperabilityDataManager');

        Logger.info('[' + siteID + '] Starting cleanup of expired Klarna interoperability data');

        var count = KlarnaInteroperabilityDataManager.cleanupExpiredData();

        if (count > 0) {
            Logger.info('[' + siteID + '] Successfully cleaned up ' + count + ' expired interoperability data records');
        } else {
            Logger.debug('[' + siteID + '] No expired interoperability data records found');
        }

        return new Status(Status.OK);
    } catch (e) {
        Logger.error('Error cleaning up Klarna interoperability data: {0}', e.message + e.stack);
        return new Status(Status.ERROR);
    }
};
