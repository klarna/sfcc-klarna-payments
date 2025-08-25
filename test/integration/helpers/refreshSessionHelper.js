const request = require('request-promise').defaults({ simple: false });
var config = require('../it.config');
var testData = require('./common');

async function getKlarnaSessionFromLiveServer() {
    // Keep cookies across calls
    const jar = request.jar();
    var variantId = testData.variantId;
    var quantity = 1;

    var myRequest = {
        url: '',
        method: 'POST',
        rejectUnauthorized: false,
        resolveWithFullResponse: true,
        jar: jar,
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    };

    myRequest.url = config.baseUrl + '/Cart-AddProduct';
    myRequest.form = {
        pid: variantId,
        quantity: quantity
    };

    //Create basket by adding a product
    // console.log('[Helper] Adding product to basket:', variantId);
    let addProdResponse = await request(myRequest);
    // console.log('[Helper] AddProduct status:', addProdResponse.statusCode);

    //Call KlarnaPayments-RefreshSession
    // console.log('[Helper] Calling KlarnaPayments-RefreshSession...');
    const refreshResponse = await request({
        uri: `${config.baseUrl}/KlarnaPayments-RefreshSession`,
        jar,
        json: true,
        resolveWithFullResponse: true
    });

    // console.log('[Helper] RefreshSession status:', refreshResponse.statusCode);
    // console.log('[Helper] Klarna body:', refreshResponse.body);

    return refreshResponse.body;
}

module.exports = { getKlarnaSessionFromLiveServer };
