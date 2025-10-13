'use strict';

var Status = require( 'dw/system/Status' );
var WebhookHelper = require( '*/cartridge/scripts/webhook/webhookHelper' );
var Logger = require( 'dw/system/Logger' );

exports.deleteWebhookNotification = function( params ) {
    try {
        var expiryDays = params ? params.ExpiryDays : null;
        expiryDays = expiryDays !== null ? Number( expiryDays ) : null;

        if ( expiryDays === null || isNaN( expiryDays ) || expiryDays < 0 ) {
            Logger.error( 'ExpiryDays parameter is missing or invalid in deleteWebhookNotification job.' );
            return new Status( Status.ERROR );
        }
        WebhookHelper.deleteWebhookNotifications( { expiryDays } );
        return new Status( Status.OK );
    } catch ( e ) {
        Logger.error( 'Error in deleteWebhookNotification.js: {0}', e.message + e.stack );
        return new Status( Status.ERROR );
    }
};