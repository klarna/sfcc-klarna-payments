'use strict';

/**
 * Helper module for managing Klarna Order Mappings.
 * One custom object per SFCC order (keyed by orderNo).
 * Allows callback endpoints to use OrderMgr.getOrder() and bypass
 * the "Filter storefront orders by customer session" SFCC setting.
 *
 * @module cartridge/scripts/util/klarnaOrderMappingHelper
 */

var CustomObjectMgr = require('dw/object/CustomObjectMgr');
var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger');
var Calendar = require('dw/util/Calendar');

var log = Logger.getLogger('KlarnaOrderMapping');

var CUSTOM_OBJECT_TYPE = 'KlarnaOrderMapping';

/**
 * Save (create or update) an order mapping.
 * Keyed by orderNo — only one record is ever created per order.
 * If the session ID changes during checkout the same record is updated in place.
 *
 * @param {string} sessionID - Klarna session ID
 * @param {string} orderNo   - SFCC order number (primary key)
 * @returns {boolean} true on success
 */
function saveMapping(sessionID, orderNo) {
    if (!orderNo) {
        log.error('saveMapping: orderNo is required');
        return false;
    }

    try {
        Transaction.wrap(function () {
            var mapping = CustomObjectMgr.getCustomObject(CUSTOM_OBJECT_TYPE, orderNo);
            if (!mapping) {
                mapping = CustomObjectMgr.createCustomObject(CUSTOM_OBJECT_TYPE, orderNo);
            }
            if (sessionID) {
                mapping.custom.sessionId = sessionID;
            }
        });

        log.info('Saved order mapping - orderNo: ' + orderNo + ', sessionID: ' + (sessionID || 'N/A'));
        return true;
    } catch (e) {
        log.error('saveMapping error: ' + e);
        return false;
    }
}

/**
 * Get SFCC order number by Klarna session ID.
 * Queries the sessionId attribute — returns the primary key (orderNo).
 *
 * @param {string} sessionID - Klarna session ID
 * @returns {string|null} SFCC order number or null if not found
 */
function getOrderNoBySessionID(sessionID) {
    if (!sessionID) {
        log.warn('getOrderNoBySessionID: no sessionID provided');
        return null;
    }

    var results;
    try {
        results = CustomObjectMgr.queryCustomObjects(
            CUSTOM_OBJECT_TYPE,
            'custom.sessionId = {0}',
            null,
            sessionID
        );

        if (results.hasNext()) {
            var mapping = results.next();
            var orderNo = mapping.custom.orderNo;
            log.info('Found mapping by sessionID: ' + sessionID + ' -> orderNo: ' + orderNo);
            return orderNo;
        }

        log.warn('No mapping found for sessionID: ' + sessionID);
        return null;
    } catch (e) {
        log.error('getOrderNoBySessionID error: ' + e);
        return null;
    } finally {
        if (results) { results.close(); }
    }
}

/**
 * Cleanup mappings older than the specified threshold.
 * Uses the system creationDate attribute (automatically set by SFCC).
 *
 * @param {number} hoursOld - Age threshold in hours (default 72)
 * @returns {number} Number of mappings deleted
 */
function cleanupOldMappings(hoursOld) {
    var threshold = hoursOld || 72;
    var deletedCount = 0;

    try {
        var cutoffTime = new Calendar();
        cutoffTime.add(Calendar.HOUR, -threshold);

        var mappings = CustomObjectMgr.queryCustomObjects(
            CUSTOM_OBJECT_TYPE,
            'creationDate < {0}',
            null,
            cutoffTime.time
        );

        try {
            Transaction.wrap(function () {
                while (mappings.hasNext()) {
                    var obj = mappings.next();
                    CustomObjectMgr.remove(obj);
                    deletedCount++;
                }
            });
        } finally {
            mappings.close();
        }

        log.info('Cleaned up ' + deletedCount + ' mapping(s) older than ' + threshold + ' hours');
    } catch (e) {
        log.error('cleanupOldMappings error: ' + e);
    }

    return deletedCount;
}

module.exports = {
    saveMapping: saveMapping,
    getOrderNoBySessionID: getOrderNoBySessionID,
    cleanupOldMappings: cleanupOldMappings
};
