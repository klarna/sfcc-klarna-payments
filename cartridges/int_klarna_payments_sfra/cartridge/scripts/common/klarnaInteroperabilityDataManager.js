/**
 * Klarna Interoperability Data Manager
 *
 * Used to manage Klarna interoperability data storage in custom objects
 * instead of session to avoid quota violations
 */

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var log = Logger.getLogger('KlarnaPayments');

var CUSTOM_OBJECT_TYPE = 'KlarnaInteroperabilityData';
var EXPIRY_HOURS = 24;

/**
 * Saves interoperability data to custom object
 *
 * @param {string} basketId - The basket ID to use as key
 * @param {Object} interoperabilityData - The interoperability data object
 * @returns {boolean} true if saved successfully, false otherwise
 */
function saveInteroperabilityData(basketId, interoperabilityData) {
    if (empty(basketId)) {
        log.error('Cannot save interoperability data: basketId is required');
        return false;
    }

    try {
        var success = false;
        Transaction.wrap(function () {
            // Remove existing object if present
            var existingObject = CustomObjectMgr.getCustomObject(CUSTOM_OBJECT_TYPE, basketId);
            if (existingObject) {
                CustomObjectMgr.remove(existingObject);
            }

            // Create new custom object
            var customObject = CustomObjectMgr.createCustomObject(CUSTOM_OBJECT_TYPE, basketId);

            if (!customObject) {
                log.error('Failed to create custom object for basketId: ' + basketId);
                return;
            }

            var now = new Date();
            var expiryDate = new Date(now.getTime() + (EXPIRY_HOURS * 60 * 60 * 1000));

            customObject.custom.interoperabilityData = JSON.stringify(interoperabilityData);
            customObject.custom.expiryTime = expiryDate;

            success = true;
            log.debug('Interoperability data saved for basketId: ' + basketId);
        });

        return success;
    } catch (e) {
        log.error('Error saving interoperability data for basketId ' + basketId + ': ' + e.message);
        return false;
    }
}

/**
 * Cleans up expired interoperability data
 * This can be called from a job to periodically clean up expired entries
 *
 * @returns {number} Number of records cleaned up
 */
function cleanupExpiredData() {
    try {
        var count = 0;
        var now = new Date();

        var iterator = CustomObjectMgr.queryCustomObjects(
            CUSTOM_OBJECT_TYPE,
            'custom.expiryTime < {0}',
            'custom.expiryTime asc',
            now
        );

        Transaction.wrap(function () {
            while (iterator.hasNext()) {
                var customObject = iterator.next();
                CustomObjectMgr.remove(customObject);
                count++;
            }
        });

        if (count > 0) {
            log.info('Cleaned up ' + count + ' expired interoperability data records');
        }

        return count;
    } catch (e) {
        log.error('Error cleaning up expired interoperability data: ' + e.message);
        return 0;
    }
}

module.exports = {
    saveInteroperabilityData: saveInteroperabilityData,
    cleanupExpiredData: cleanupExpiredData
};
