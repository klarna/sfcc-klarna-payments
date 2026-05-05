# Klarna for Salesforce Commerce Cloud

## What's new in 

* Added support for passing currency and correctly mapped theme parameters in Klarna OSM API requests.
* Introduced Sign in with Klarna Web SDK v2, restoring updated SIWK flow and replacing refresh token usage with ID token authentication.
* Removed legacy Klarna Web SDK v1 script and ensured only v2 SDK is loaded across all pages to improve performance.
* Updated Klarna integration to replace deprecated interoperability_token with klarna_network_session_token across KEC and standard checkout flows.
* Fixed Klarna callback failures with SFCC session filtering enabled by replacing queryOrder() with direct order lookup and introducing custom object mapping for reliable server-to-server processing.

See `CHANGELOG.md` for full version history.

## Integration Overview

The Klarna Payments cartridge enables integration of Klarna payment solutions on Commerce Cloud Storefront, built on Salesforce Reference Architecture (SFRA). It provides merchants the flexibility to offer multiple Klarna payment products based on site configurations.

For the integration manual, see the `Klarna Payments SFRA Integration Guide.pdf` in the `documentation` directory.

### Cartridge Documentation

[Klarna SFCC Documentation](https://docs.klarna.com/platform/salesforce-commerce-cloud/get-started/prerequisites/)

### Compatibility

* SFRA 7.x
* Compatibility mode 21.2+

### Cartridges

* `int_klarna_payments` - Base functionality
* `int_klarna_payments_sfra` - SFRA-specific logic

### Features

**Klarna Products**
* Klarna Payments (KP) - Pay Now, Pay Later and Pay Over Time payment categories
* Onsite Messaging (OSM) - Placements on PDP, Cart, Header, Footer, and dedicated Info page
* Klarna Express Checkout (KEC) - One-step checkout on PDP, minicart and cart
* Sign In With Klarna (SIWK) - Social login using Klarna account

**Checkout and Payments**
* Standard Commerce Cloud checkout support: cart updates, coupon codes, product level promotions, order level promotions, shipping level promotions, and more
* Klarna fraud notification updates for orders placed
* Klarna Payment Method based promotions
* Adjusted price promotions with Gross Tax Policy
* Handling of rejected payment method - hide or gray out
* Virtual Credit Card settlement (Merchant Card Service)

**Additional**
* Multiple locales support
* GDPR (EU) compliant checkout flow
* BOPIS (Buy Now, Pay in Store) support with extra merchant data

## NPM scripts

`npm install` - Install all local dependencies.
`npm run compile:scss` - Compiles all .scss files.
`npm run compile:js` - Compiles all .js files.
`npm run lint` - Linting for all CSS and JavaScript files.
`npm run uploadSFRA` - Uploads `int_klarna_payments_sfra` to the server. Requires a valid `dw.json` file at the root configured for the sandbox.

## Tests

### Unit tests

1. `npm install`
2. `npm run test`

### Integration tests

1. `npm install`
2. Make sure you have a `dw.json` file pointing to a sandbox.
3. Make sure the product id defined with `variantId` in `helpers\common.js` points to a valid, online product.
4. Change `baseUrl` in `it.config.js` if necessary.
5. `npm run test:integration`

**Sample `dw.json` file:**
```json
{
    "hostname": "your-sandbox-hostname.demandware.net",
    "username": "yourlogin",
    "password": "yourpwd",
    "code-version": "version_to_upload_to"
}
```

## Support

Cartridge functionality depends on the availability of the Klarna API service. Current operational status: [status.klarna.com](http://status.klarna.com/)

To report a core functionality issue, contact <commercecloud@klarna.com>
