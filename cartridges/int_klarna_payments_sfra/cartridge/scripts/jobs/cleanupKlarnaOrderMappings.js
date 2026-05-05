'use strict';

/**
 * Job script to cleanup old Klarna Order Mappings
 *
 * This job should be scheduled to run daily to remove old mapping records
 * that are no longer needed (typically older than 48-72 hours).
 *
 * @module cartridge/scripts/jobs/cleanupKlarnaOrderMappings
 */

var Logger = require('dw/system/Logger');
var Status = require('dw/system/Status');

/**
 * Main job execution function
 *
 * @param {Object} args Job parameters
 * @param {number} args.hoursOld - Age threshold in hours (default: 72)
 * @returns {dw.system.Status} Job status
 */
function execute(args) {
    var log = Logger.getLogger('KlarnaOrderMappingCleanup');
    var orderMappingHelper = require('*/cartridge/scripts/util/klarnaOrderMappingHelper');

    try {
        var hoursOld = args && args.hoursOld ? parseInt(args.hoursOld, 10) : 72;

        if (isNaN(hoursOld) || hoursOld < 1) {
            log.error('Invalid hoursOld parameter: ' + args.hoursOld + '. Using default: 72');
            hoursOld = 72;
        }

        log.info('Starting cleanup of Klarna Order Mappings older than ' + hoursOld + ' hours');

        var deletedCount = orderMappingHelper.cleanupOldMappings(hoursOld);

        log.info('Cleanup completed successfully. Deleted ' + deletedCount + ' mapping(s)');

        return new Status(Status.OK, 'OK', 'Deleted ' + deletedCount + ' old mapping(s)');
    } catch (e) {
        log.error('Error during cleanup: ' + e.message + '\n' + e.stack);
        return new Status(Status.ERROR, 'ERROR', 'Cleanup failed: ' + e.message);
    }
}

module.exports = {
    execute: execute
};
