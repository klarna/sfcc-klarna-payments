'use strict';

/**
 * @namespace Account
 */

var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var userLoggedIn = require('*/cartridge/scripts/middleware/userLoggedIn');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

var page = module.superModule; // inherits functionality
server.extend(page);

/**
 * Account-SubmitRegistration : The Account-SubmitRegistration endpoint is the endpoint that gets hit when a shopper submits their registration for a new account
 * @name Base/Account-SubmitRegistration
 * @function
 * @memberof Account
 * @param {middleware} - server.middleware.https
 * @param {middleware} - csrfProtection.validateAjaxRequest
 * @param {querystringparameter} - rurl - redirect url. The value of this is a number. This number then gets mapped to an endpoint set up in oAuthRenentryRedirectEndpoints.js
 * @param {httpparameter} - dwfrm_profile_customer_firstname - Input field for the shoppers's first name
 * @param {httpparameter} - dwfrm_profile_customer_lastname - Input field for the shopper's last name
 * @param {httpparameter} - dwfrm_profile_customer_phone - Input field for the shopper's phone number
 * @param {httpparameter} - dwfrm_profile_customer_email - Input field for the shopper's email address
 * @param {httpparameter} - dwfrm_profile_customer_emailconfirm - Input field for the shopper's email address
 * @param {httpparameter} - dwfrm_profile_login_password - Input field for the shopper's password
 * @param {httpparameter} - dwfrm_profile_login_passwordconfirm: - Input field for the shopper's password to confirm
 * @param {httpparameter} - dwfrm_profile_customer_addtoemaillist - Checkbox for whether or not a shopper wants to be added to the mailing list
 * @param {httpparameter} - csrf_token - hidden input field CSRF token
 * @param {category} - sensitive
 * @param {returns} - json
 * @param {serverfunction} - post
 */
server.prepend(
    'SubmitRegistration',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var klarnaOSM = require('*/cartridge/scripts/marketing/klarnaOSM');
        if (!klarnaOSM.isKlarnaSignInEnabled()) {
            return next();
        }

        var CustomerMgr = require('dw/customer/CustomerMgr');
        var Resource = require('dw/web/Resource');
        var signInHelper = require('*/cartridge/scripts/signin/klarnaSignIn');

        var formErrors = require('*/cartridge/scripts/formErrors');

        var registrationForm = server.forms.getForm('profile');

        // form validation
        if (registrationForm.customer.email.value.toLowerCase()
            !== registrationForm.customer.emailconfirm.value.toLowerCase()
        ) {
            registrationForm.customer.email.valid = false;
            registrationForm.customer.emailconfirm.valid = false;
            registrationForm.customer.emailconfirm.error =
                Resource.msg('error.message.mismatch.email', 'forms', null);
            registrationForm.valid = false;
        }

        var email = registrationForm.customer.email.value.toLowerCase();

        var customerExists = signInHelper.checkKlarnaCustomerExists(email);
        if (customerExists) {
            registrationForm.customer.email.valid = false;
            registrationForm.customer.email.error = Resource.msg('error.message.username.invalid', 'forms', null);
            registrationForm.valid = false;
        }
        if (!registrationForm.valid) {
            res.json({
                fields: formErrors.getFormErrors(registrationForm)
            });
            this.emit('route:Complete', req, res);
            return;
        }

        return next();
    }
);


module.exports = server.exports();
