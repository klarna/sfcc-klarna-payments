/**
* Script to get Locale from KlarnaCountries custom object
*
* @module cartridge/scripts/locale/klarnaPaymentsGetLocale
 *
 * @input CurrentCountry : String
 * @output LocaleObject : Object
 */

var CustomObjectMgr = require( 'dw/object/CustomObjectMgr' );
var Logger = require( 'dw/system/Logger' );
var Locale = require( 'dw/util/Locale' );

/**
 * Function that can be called by pipelines
 * 
 * @param {Object} args Object parameters
 * @return {number} status
 */
function execute( args ) {
    var getLocaleResult = getLocaleObject( args.CurrentCountry );
    if ( getLocaleResult.success ) {
        args.LocaleObject = getLocaleResult.localeObject;
        return PIPELET_NEXT;
    }
    return PIPELET_ERROR;
}

/**
 * Function that gets the locale object from given country custom object
 * 
 * @param {String} currentCountry Country code
 * @return {Object} Object containing status, locale object and country code
 */
function getLocaleObject( currentCountry ) {
    var countryCode = currentCountry;
    try {
        var localeObject = {};

        if ( empty( countryCode ) ) {
            var countryFromLocaleHelper = require( '*/cartridge/scripts/locale/klarnaPaymentsGetCountryFromLocale' );
            countryCode = countryFromLocaleHelper.getCountryFromLocale( request ).countryCode;
        } else {
            countryCode = 'default';
        }

        var customlocaleObject = CustomObjectMgr.getCustomObject( 'KlarnaCountries', countryCode );

        if ( empty( customlocaleObject ) ) {
            throw new Error( 'Klarna - No active locale custom object found' );
        }

        localeObject.custom = {};
        Object.keys( customlocaleObject.custom ).forEach( function( key ) {
            localeObject.custom[key] = customlocaleObject.custom[key];
        } );

        if ( countryCode !== 'default' ) {
            localeObject.custom.klarnaLocale = buildKlarnaCompatibleLocale();
        }

        return {
            success: true,
            localeObject: localeObject,
            countryCode: countryCode
        }
    } catch( e ) {
        Logger.error( e );
        return {
            success: false,
            localeObject: null,
            countryCode: countryCode
        }
    }
}

/**
 * Function that provides the request locale in a klarna compatible format
 * @return {string} locale code
 */
function buildKlarnaCompatibleLocale() {
    var requestLocale = Locale.getLocale( request.locale );
    var resultLocale = requestLocale.language;

    if ( requestLocale.country ) {
        resultLocale = resultLocale + '-' + requestLocale.country;
    }

    return resultLocale.toLowerCase();
}

module.exports = {
    getLocaleObject: getLocaleObject
}