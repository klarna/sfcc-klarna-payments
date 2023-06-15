var Site = require( 'dw/system/Site' );
var currentSite = Site.getCurrent();
var kpAdditionalLogging = currentSite.getCustomPreferenceValue( 'kpAdditionalLogging' ) || false;
var Logger = require( 'dw/system/Logger' );
var log = Logger.getLogger( 'KlarnaAdditionalLog', 'KlarnaAdditionalLog' );

/**
 * Writing additional logs
 *
 * @param  {string} actionName place where call performed
 * @returns {void}
 */
function writeLog( lineItemCntr, KlarnaSessionID, actionName, message ) {
    if ( kpAdditionalLogging && lineItemCntr ) {

        writeSitePreferencesToLog();

        var logObj = {
            actionName: actionName,
            message: message,
            KlarnaSessionID: KlarnaSessionID,
            adjustedMerchandizeTotalGrossPrice: lineItemCntr.adjustedMerchandizeTotalGrossPrice.value,
            adjustedMerchandizeTotalNetPrice: lineItemCntr.adjustedMerchandizeTotalNetPrice.value,
            adjustedMerchandizeTotalPrice: lineItemCntr.adjustedMerchandizeTotalPrice.value,
            adjustedMerchandizeTotalTax: lineItemCntr.adjustedMerchandizeTotalTax.value,
            adjustedShippingTotalGrossPrice: lineItemCntr.adjustedShippingTotalGrossPrice.value,
            adjustedShippingTotalNetPrice: lineItemCntr.adjustedShippingTotalNetPrice.value,
            adjustedShippingTotalPrice: lineItemCntr.adjustedShippingTotalPrice.value,
            adjustedShippingTotalTax: lineItemCntr.adjustedShippingTotalTax.value,
            currencyCode: lineItemCntr.currencyCode,
            giftCertificateTotalGrossPrice: lineItemCntr.giftCertificateTotalGrossPrice.value,
            giftCertificateTotalNetPrice: lineItemCntr.giftCertificateTotalNetPrice.value,
            giftCertificateTotalPrice: lineItemCntr.giftCertificateTotalPrice.value,
            giftCertificateTotalTax: lineItemCntr.giftCertificateTotalTax.value,
            merchandizeTotalGrossPrice: lineItemCntr.merchandizeTotalGrossPrice.value,
            merchandizeTotalNetPrice: lineItemCntr.merchandizeTotalNetPrice.value,
            merchandizeTotalPrice: lineItemCntr.merchandizeTotalPrice.value,
            merchandizeTotalTax: lineItemCntr.merchandizeTotalTax.value,
            productQuantityTotal: lineItemCntr.productQuantityTotal,
            shippingTotalGrossPrice: lineItemCntr.shippingTotalGrossPrice.value,
            shippingTotalNetPrice: lineItemCntr.shippingTotalNetPrice.value,
            shippingTotalPrice: lineItemCntr.shippingTotalPrice.value,
            shippingTotalTax: lineItemCntr.shippingTotalTax.value,
            totalGrossPrice: lineItemCntr.totalGrossPrice.value,
            totalNetPrice: lineItemCntr.totalNetPrice.value,
            totalTax: lineItemCntr.totalTax.value,
            UUID: lineItemCntr.UUID,
            lineItems: []
        }

        var allLineItemsIterator = lineItemCntr.getAllLineItems().iterator();
        var allLineItems = lineItemCntr.getAllLineItems();

        while ( allLineItemsIterator.hasNext() ) {
            var item = allLineItemsIterator.next();
            var itemObj = {
                lineItemType: item.constructor.name,
                basePrice: item.basePrice.value,
                grossPrice: item.grossPrice.value,
                netPrice: item.netPrice.value,
                price: item.price.value,
                tax: item.tax.value,
                taxBasis: item.taxBasis.value,
                taxClassID: item.taxClassID,
                taxRate: item.taxRate,
                UUID: item.UUID
            };
            
            if (item.constructor.name === 'dw.order.ProductLineItem') {
                itemObj.adjustedGrossPrice = item.adjustedGrossPrice.value;
                itemObj.adjustedNetPrice = item.adjustedNetPrice.value;
                itemObj.adjustedPrice = item.adjustedPrice.value;
                itemObj.adjustedTax = item.adjustedTax.value;
                itemObj.gift = item.gift;
                itemObj.productID = item.productID;
                itemObj.productName = item.productName;
                itemObj.proratedPrice = item.proratedPrice.value;
                itemObj.quantity = item.quantity.value;
            } else if (item.constructor.name === 'dw.order.ShippingLineItem') {
                itemObj.adjustedGrossPrice = item.adjustedGrossPrice.value;
                itemObj.adjustedNetPrice = item.adjustedNetPrice.value;
                itemObj.adjustedPrice = item.adjustedPrice.value;
                itemObj.adjustedTax = item.adjustedTax.value;
                itemObj.ID = item.ID;
            } else if (item.constructor.name === 'dw.order.GiftCertificateLineItem') {
                itemObj.giftCertificateID = item.giftCertificateID;
            } else if (item.constructor.name === 'dw.order.PriceAdjustment') {
                itemObj.campaignID = item.campaignID;
                itemObj.promotionID = item.promotionID;
            } else if (item.constructor.name === 'dw.order.ProductShippingLineItem') {
                itemObj.surcharge = item.surcharge;
            }

            logObj.lineItems.push( itemObj );
        }

        log.info( JSON.stringify( logObj ) );
    }
 }

/**
 * Writing Klarna SitePreference to additional logs
 *
 * @returns {void}
 */
function writeSitePreferencesToLog () {
    if (kpAdditionalLogging) {
        var logObj = {
            kpAutoCapture: currentSite.getCustomPreferenceValue( 'kpAutoCapture' ) || false,
            kpAttachments: currentSite.getCustomPreferenceValue( 'kpAttachments' ) || false,
            kpVCNEnabled: currentSite.getCustomPreferenceValue( 'kpVCNEnabled' ) || false,
            kpVCNRetryEnabled: currentSite.getCustomPreferenceValue( 'kpVCNRetryEnabled' ) || false,
            kpPromoTaxation: currentSite.getCustomPreferenceValue( 'kpPromoTaxation' ).value || false,
            kpCreateNewSessionWhenExpires: currentSite.getCustomPreferenceValue( 'kpCreateNewSessionWhenExpires' ) || false,
            kpRateLimitByOperation: currentSite.getCustomPreferenceValue( 'kpRateLimitByOperation' ) || false,
            kpUseAlternativePaymentFlow: currentSite.getCustomPreferenceValue( 'kpUseAlternativePaymentFlow' ).value || false,
            kpPaymentIntent: currentSite.getCustomPreferenceValue( 'kpPaymentIntent' ).value || false,
        }

        log.info( 'SitePreferences Configuration:' + JSON.stringify( logObj ) );
    }
}

exports.writeSitePreferencesToLog = writeSitePreferencesToLog;
exports.writeLog = writeLog;
