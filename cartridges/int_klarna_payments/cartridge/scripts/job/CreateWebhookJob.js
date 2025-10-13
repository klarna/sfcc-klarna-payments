'use strict';

var Status = require( 'dw/system/Status' );
var KlarnaHelper = require( '*/cartridge/scripts/util/klarnaHelper' );
var WebhookHelper = require( '*/cartridge/scripts/webhook/webhookHelper' );
var Logger = require( 'dw/system/Logger' );

exports.createWebhook = function( params ) {
    try {
        // Initialize Klarna credentials
        KlarnaHelper.isCurrentCountryKlarnaEnabled();
        var existingSigningKey = WebhookHelper.getExistingSigningKey();
        if ( !existingSigningKey ) {
            var signingKey = WebhookHelper.createSigningKey();
            existingSigningKey = WebhookHelper.saveSigningKey( signingKey );
            if ( !existingSigningKey ) {
                Logger.error( 'Error occured during Signing Key Creation' );
                return new Status( Status.ERROR );
            }
        }

        var eventTypes = params && params.EventTypes ? WebhookHelper.processEventTypes( params.EventTypes ) : null;
        var signingKeyId = existingSigningKey.custom.signingKeyId;
        var existingWebhook = WebhookHelper.checkIfWebhookExists( signingKeyId );

        if ( existingWebhook ) {
            var eventTypesExists = WebhookHelper.checkIfEventTypesPresent( {existingWebhook, eventTypes} );

            if ( !eventTypesExists ) {
                var updatedWebhook = WebhookHelper.updateWebhook( {existingWebhook, eventTypes} );
                if ( !updatedWebhook || !updatedWebhook.webhook_id ) {
                    Logger.error( 'Error occured during Webhook Updation' );
                    return new Status( Status.ERROR );
                }
            }
        } else {
            var webhookResponse = WebhookHelper.createWebhook( {signingKeyId, eventTypes } );

            if ( !webhookResponse || !webhookResponse.webhook_id ) {
                Logger.error( 'Error occured during Webhook Creation' );
                return new Status( Status.ERROR );
            }
        }
        return new Status( Status.OK );
    } catch ( e ) {
        Logger.error( 'Error in CreateWebhookJob.js: {0}', e.message + e.stack );
        return new Status( Status.ERROR );
    }
};