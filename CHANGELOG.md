# CHANGELOG

## 25.5.0
* When Klarna payments are integrated through a PSP, the interoperability_data is required by the PSP for payment processing and order finalization. As part of this release, we have added interoperability_data to the session. This data includes the order amount and the order lines for which the payment was initiated. The PSP will be able to retrieve this information from the session for further processing.

## 25.4.0
* Added webhook subscription for KEC one-step checkout via PSP. A storefront site can now subscribe to webhook and receive notifications for subscribed payment events. These notifications are stored in a custom object for further processing.
* Fixed unnecessary error logging during checkout, where subscription-related errors were being logged even when no subscription products were present in the cart. 

## 25.3.0
* Updated sales tax amount to be zero if the tax mount results in a negative value in the API request payload. Negative salesTax values only arise from discount or credit adjustments, never from system errors.
* Updates based on review comments from last release. Mainly to remove the usage of Maths.round fuction which rounded of some amounts, renamed some fucntions for better clarity etc.
* Updates on some unit and integration test suites.

## 25.2.0
* Updated EMD handling to support the Klarna Deals feature. The payment_history_full object is sent in the Authorization call. This moves EMD data from session/order creation to the Authorization phase.
* Minor updates to Klarna Express Checkout to support broader API compatibility.

## 25.1.0
* This release includes improvements to subscription handling, Klarna Express Checkout (KEC), bug fixes, and technical updates to enhance stability and performance.
### Improvements
* Subscription Support Enhancements:
    * Modified subscription order creation to improve order accuracy and reduce failures.
    * Enhanced subscription handling on Product Detail Pages (PDP) for better clarity and user guidance.
    * Improved subscription handling capabilities on the Cart Page, ensuring smoother cart interactions.
    * Updated subscription integration in the Checkout Page, enhancing reliability, reducing errors, and   improving overall performance.
* Updated the scope to customer:login to enhance user session management and security.
* Klarna SFCC jobs are updated with the latest version of steptypes.json for improved workflow efficiency.
* Removed hardcoded 'identifier' references in SFCC, increasing maintainability and reducing potential integration issues.
* Performance improvements
### Bug Fixes
* Fixed an issue where Klarna Express Checkout (KEC) was failing to load.
* Corrected a problem that prevented proper ordering of subscription products.
* Fixed a display issue where "Intent" was incorrectly shown as "tokenize" for subscription orders.
* Addressed issues with orders created via payloads appearing as uncaptured.
* Fixed an issue where the order confirmation page was not displayed for subscription orders.

## 24.6.0
* Auth callback feature for client-side calls to ensure that orders can still be placed even if there are frontend communication issues.
* Bug fixes.
## 24.5.0
* Upgrade to SFRA7
* Sign In With Klarna (SIWK): A social login feature tailored for shopping, allowing customers to quickly and securely sign up for your platform using their Klarna account information.
* Bug fixes
## 24.4.0
* Sign In With Klarna (SIWK): A social login feature tailored for shopping, allowing customers to quickly and securely sign up for your platform using their Klarna account information.
* RO and CZ countries support.
* Configuration structure updates: New Settings Points: Klarna Activation Custom Object, Site Preferences: Klarna Activation (Klarna_Activation), Klarna Payments (Klarna_KP), Klarna Sign-in With Klarna (Klarna_siwk), Klarna Express Checkout (Klarna_KEC), Klarna On-site Messaging (Klarna_OSM).
* Deprecations: Klarna Countries Custom Object, Site Preferences: Klarna Payments (Klarna_Payments), Klarna Recurring Payments (Klarna_RecurringPayments), Klarna Express Checkout (Klarna_ExpressCheckout), Removed Site Preferences Attributes: kpServiceName, kpBankTransferCallback, kpRejectedMethodDisplay, kpNotAvailableMessage, vcnPrivateKey, vcnPublicKey, KpRateLimitByOperation, kpCreateNewSessionWhenExpires, sendProductAndImageURLs.
## 24.3.0
* Update of Klarna Express Checkout configuration. The display of Klarna Express Checkout buttons is now customizable by selecting preferred placements. By default none is selected.
* Documentation update – new section added Klarna Display Conditions and Authorization Handling.
## 24.2.0
* Update of OSM functionality that is more aligned with current web standards, provides a consistent identifier system as used in KEC, and offers enhanced customization options to our merchants. This will not only improve the user experience but also reinforce Klarna’s commitment to providing versatile and state-of-the-art e-commerce solutions. CSS customizations are available only in the new library version.
* Documentation update - new section added for cartridge upgrade process.
## 24.1.0
* Klarna Express Checkout: a new feature introduced in Storefront where Express Checkout Button will be displayed in PDP, Cart and Mini Cart and user will be redirected to Klarna after clicking Express Checkout button. Klarna Express Checkout enabled quick and easy checkout where Shipping Address, Billing Address and Payment details will be preselected so that Checkout can be completed in fewer clicks.
* Fix for create order service calls with 500 status response: now orders are not created and error is thrown for these cases.

## 23.2.0
* Subscription Payments support: recurring payments and subscription handling directly within the SFCC environment. This update includes configuration options, subscription management in the cart and checkout pages, and a customer dashboard for subscription oversight.
* Klarna Bank Transfer payment: added a new server-side authorization callback feature for Klarna Bank Transfer payments, enhancing reliability across EU markets and supporting all existing KP cartridge functionalities.

## 23.1.1
* Fixed an issue where sessions with negative order_tax_amount occurred due to SFCC session expiration
* Compatibility mode 21.2 support
* Replace deprecated window.KlarnaOnsiteService.push with window.Klarna.OnsiteMessaging.refresh.

## 23.1.0
* Fix issue with incorrect values for EMD
* Improvement Klarna Auto Capture and error handling
* Logging information for troubleshooting bugs
* Add Auto_finalise=True to the review checkout flow.

## 22.5.0
### Changed
* OMS support

## 22.4.0
### Changed
* Intent field addition in Klarna Payment session creation
* Combine Klarna Authorization and Create Order in Checkout Review Step

## 22.3.1
### Changed
* Fix User-agent version sent to Klarna services

## 22.3.0
### Changed
* SFRA ver. 6.0.0 support
* Rollback hide VAT from Checkout functionality

## 22.2.1
### Changed
* Rollback of One Klarna Optimisation

## 22.2.0
### Changed
* SFRA ver 6.0.0 support
* One Klarna Optimisation
* Mexico locale support

## 22.1.0
### Changed
* Improvements for create and update session errors
* Added Klarna Express Button in minicart
* Support for long-running basket
* Rate-limits by operations

## 21.3.1
### Changed
* Documentation updates

## 21.3.0
### Added
* Minor bug fixes for create_session
* New locale tempates for Poland

## 21.2.0
### Added
* Klarna Express Button on Cart Page
* Moved Klarna session ID & client token from SFCC session privacy to Basket attributes.

### Changed
* Changed KlarnaCountries definition to not replicable
* Code Cleanup
* Documentation updates

## 21.1.2
* Fixed core file naming convention issues in 21.1.0 and 21.1.1
* Removed deprecated “scripts/util/Builder.js” file

## 21.1.1
### Added
* New On-Site Messaging configuratoin setting for Canada
* New locale tempates for Norway

### Removed
* Not required locale templates in SG - ES & BE

## 21.1.0
### Added
* New country locales - CA, IT, FR & NZ
* BOPIS (Buy Now, Pay in Store) support with extra merchant data
* New OSM placements - header, footer and dedicated info page
* Support for Klarna Payment Method based promotions
* Support for adjusted price promotions with Gross Tax Policy
* Handling of rejected payment method - hide or gray out
* VCN Settlement retry option

### Changed
* Updates to VCN error handling
* Fixed `SubmitShipping` route handling for external tax providers
* Documentation updates


### Removed
* Acknowledge call
* Pipelines cartridge

## 19.1.6
### Added
* New country locales: SFRA – es_ES, SiteGenesis – es_ES, nl_BE, fr_BE

### Changed
* Updated VCN implementation to store secure Credit Card details

### Removed
* Decrypted Credit Card details in Order attributes – kpVCNPAN, kpVCNCSC, kpVCNExpirationMonth, kpVCNExpirationYear

## 19.1.5
### Added
* Additional verification for all notifications
* New Canadian locales support - en_CA, fr_CA

### Changed
* Minor fixes around the KlarnaCountries configuration objects
* Updated location of CSS & JS files in SFRA cartridge to follow best practices
* Documentation updates

## 19.1.4
### Added
* Additional country locales for SFRA – en_ES, en_BE, en_IT, en_FR, sv_SE
* PII data sharing update for US market
* New cancel authorization functionality
* User Agent with SFCC architecture type to all service calls
* Cookie policy "SameSite=Strict"

### Changed
* Minor bug fixes
* Cartridge templates and forms updated for latest SFRA 5.0.1

### Fixed
* Deprecated SFCC API usage
* OMS Cart placement totals on update

## 19.1.3
### Changed
* On-site Messaging updates
* OC endpoint added

## 19.1.2
### Changed
* Fix auto capture for the pipeline’s cartridge

## 19.1.1
### Changed
* Updated VCN to use the newest API version (MCSv3)
