# CHANGELOG

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
* Support for long running basket
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
