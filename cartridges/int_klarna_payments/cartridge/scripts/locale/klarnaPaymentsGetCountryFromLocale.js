/**
* Script to get country code based on site current locale
*
* @module cartridge/scripts/locale/klarnaPaymentsGetCountryFromLocale
*
* @input CurrentRequest : dw.system.Request
* @output CurrentCountry : String
*
*/

/**
 * Function that can be called by pipelines
 * 
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var countryCodeResult = getCountryFromLocale( args.CurrentRequest )
    if ( !countryCodeResult.success ) {
        return PIPELET_ERROR;
    }
    args.CurrentCountry = countryCodeResult.countryCode;
    return PIPELET_NEXT;
}

/**
 * Function to get the country code from the request locale
 * 
 * @param {Object} currentRequest request object
 * @return {Object} object containing status and country code
 */
function getCountryFromLocale( currentRequest ) {
    var countryCode = null;
    try {
        var Locale = require( 'dw/util/Locale' );
        countryCode = Locale.getLocale( currentRequest.locale ).country;

        if ( empty( countryCode ) ) {
            throw new Error( 'Could not get country code from the current request' );
        }
    } catch ( e ) {
        dw.system.Logger.error( e );
        return {
            success: false
        };
    }

    return {
        success: true,
        countryCode: countryCode
    };
}

module.exports = {
    getCountryFromLocale: getCountryFromLocale
}