/* globals $ */

'use strict';

/**
 * Handle SIWK logout by clearing Klarna Identity state before navigation
 */
$(document).ready(function () {
    // Find all logout links
    $('a[href*="Login-Logout"]').on('click', async function (e) {
        // Prevent default navigation
        e.preventDefault();

        const logoutUrl = $(this).attr('href');

        try {
            // Get the Klarna SDK instance
            const klarna = window.getKlarnaSDK('siwk');
            if (!klarna || !klarna.Identity) {
                return;
            }

            if (klarna && klarna.Identity && typeof klarna.Identity.clearLoginState === 'function') {
                // Clear Klarna Identity login state
                await klarna.Identity.clearLoginState();
            }
        } catch (error) {
            console.error('Error clearing Klarna SIWK login state:', error); // eslint-disable-line no-console
        } finally {
            // Navigate to logout URL regardless of success/failure
            window.location.href = logoutUrl;
        }
    });
});
