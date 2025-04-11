[<img src="https://cdn.klarna.com/1.0/shared/image/generic/logo/global/basic/logo_black.png" alt="Klarna" width="200">](https://klarna.com)

# Klarna Payments 2017-2024 Salesforce Commerce Cloud Cartridge

## The latest version
The latest version of this cartridge is 25.1.0.

This release includes improvements to subscription handling, Klarna Express Checkout (KEC), bug fixes, and technical updates to enhance stability and performance.
### New Features
* Subscriptions Handling
    * Subscription selection is now available on product pages (PDP).
    * Klarna Express Checkout (KEC) supports subscription products.
    * Improved handling of mixed carts containing subscription and standard products.
    * Klarna checkout now processes subscription orders correctly, including trial and non-trial periods.
    * Order sorting logic ensures the correct sequence for Klarna API calls.
* Interoperability
    * Interoperability feature is now available which enable customers integrating Klarna via PSPs to seamlessly transition across partnerships
### Fixes
* Fixed an issue where Klarna orders were not completing at checkout.
* Corrected intent mapping for subscription products to align with Klarna’s API.
* Resolved an issue where some orders appeared as uncaptured in the Klarna merchant portal.
* Removed hardcoded identifiers in Klarna Express Checkout, ensuring dynamic payment method retrieval.
### Deprecations and Technical Changes
* Updated API authentication for improved session handling and security.
* Migrated Klarna SFCC jobs to the latest SFCC framework, replacing deprecated job scripts.
* Hardcoded identifiers for Klarna Express Checkout (KEC) are no longer used and are now dynamically retrieved.
* Optimized order processing logic for better performance and accuracy.


## Company Overview
Klarna Bank AB (publ) is the leading global payments and shopping service, providing smarter and more flexible shopping and purchase experiences to 90 million active consumers across more than 250,000 merchants in 17 countries. Klarna offers direct payments, pay after delivery options and instalment plans in a smooth one-click purchase experience that lets consumers pay when and how they prefer to. Klarna is active in Europe, North America and Oceania, driven by 3500 employees. Read more here: https://www.klarna.com/international/about-us/corporate-governance/



## Integration Overview
The Klarna Payments cartridges enables integration of Klarna Payment solution on Commerce Cloud Storefront. The integration provides merchants the flexibility to offer choice of multiple Klarna Payment products based on site configurations. This repository contains the Klarna integrations with the Salesforce Commerce Cloud platform. There are two versions currently available for SiteGenesis Javascript Controller (SGJS) and Salesforce Reference Architecture (SFRA). 

This repository is also pipeleines compliant. For more information contact Klarna.

### Cartridge Documentation
https://docs.klarna.com/platform-solutions/e-commerce-platforms/salesforce-commerce-cloud/before-you-start/

### Cartridges
* `int_klarna_payments` - Includes the base functionality used by SG controllers, pipeleines and SFRA
* `int_klarna_payments_controllers` - Includes SG Controllers specific logic
* `int_klarna_payments_sfra` - Includes SFRA specific logic

### Feature List
* Multiple locales support
* Klarna fraud notification updates for orders placed
* Enable multiple payment products for customer in Pay Now, Pay Later and Pay Over Time categories
* Leverages and supports standard Commerce Cloud checkout functionality such as but not limited to: cart updates, coupon codes, product level promotions, order level promotions, shipping level promotions, and more
* Support for gift cards and split payments (SiteGenesis only)
* Support for settling orders with Virtual Credit Cards issued by Klarna (Merchant Card Service)
* GDPR (EU) compliant checkout flow
* Enable Onsite Messaging placements on PDP, Cart, Header, Footer, and dedicated Info page
* BOPIS (Buy Now, Pay in Store) support with extra merchant data
* Support for Klarna Payment Method based promotions
* Support for adjusted price promotions with Gross Tax Policy
* Handling of rejected payment method - hide or gray out
* Klarna Express Button for convenient checkout experience
* Klarna Express Checkout on PDP, minicart and cart


### SiteGenesis Javascript Controller (SGJC)
For the manual, please see the `Klarna Payments Integration Guide.pdf` file in the `documentation` directory.


### Salesforce Reference Architecture (SFRA)
For the manual, please see the `Klarna Payments SFRA Integration Guide.pdf` file in the `documentation` directory.

## NPM scripts
`npm install` - Install all of the local dependencies.
`npm run compile:scss` - Compiles all .scss files and aggregates them.
`npm run compile:js` - Compiles all .js files and aggregates them.
`npm run lint` - Execute linting for all CSS & JavaScript files in the project.
`npm run uploadSFRA` - Will upload `int_klarna_payments_sfra` to the server. Requires a valid `dw.json` file at the root that is configured for the sandbox to upload.
`npm run uploadSG` - Will upload `int_klarna_payments` to the server. Requires a valid `dw.json` file at the root that is configured for the sandbox to upload.

## Tests
### Unit tests
In order to run the unit tests, do the following steps in the root of the project.
1. `npm install`
2. `npm run test`

### Integration tests
In order to run the integration tests, do the following steps in the root of the project.
1. `npm install`
2. Make sure you have a `dw.json` file pointing to a sandbox.
3. Make sure that the product id defined with `variantId` in `helpers\common.js` is pointing to a valid and online product.
4. Change `baseUrl` in `it.config.js` if necessary.
5. `npm run test:integration`

**Note:** Sample `dw.json` file
```json
{
    "hostname": "your-sandbox-hostname.demandware.net",
    "username": "yourlogin",
    "password": "yourpwd",
    "code-version": "version_to_upload_to"
}
```

## Support
Cartridge functionality will be dependent on the availability of the Klarna API service. Current Klarna operational status can be viewed here -  [http://status.klarna.com/](http://status.klarna.com/)

Reporting core functionality issue in the Klarna cartridge technical integration – please contact <commercecloud@klarna.com>
