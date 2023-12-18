/* globals session */

'use strict';

/**
 * Stop the flow if BT Callback is required
 * @param {Object} result - Authorization Result
 * @returns {Object} Returns error to stop if BT Callback is required
 */
function postAuthorization(result) { // eslint-disable-line no-unused-vars
    var finalizeRequired = session.privacy.finalizeRequired;
    if (finalizeRequired === 'true') {
        session.privacy.finalizeRequired = null;
        session.privacy.isBasketPending = 'true';
        return { error: true };
    }

    return; // eslint-disable-line consistent-return
}

exports.postAuthorization = postAuthorization;
