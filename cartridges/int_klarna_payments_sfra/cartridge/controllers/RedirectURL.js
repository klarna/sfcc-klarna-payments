'use strict';

var server = require('server');
var page = module.superModule;
server.extend(page);

server.prepend('Start', function (req, res, next) {
    var URLRedirectMgr = require('dw/web/URLRedirectMgr');
    // handle SIWK redirect
    if (URLRedirectMgr.getRedirectOrigin().indexOf('/siwk-redirect/account') !== -1) { // Intercept the incoming path request
        var siwkLocale = session.custom.siwk_locale;
        session.custom.siwk_locale = null;
        res.render('klarnapayments/siwk_redirect', { siwkLocale: siwkLocale, scriptURL: '/js/main.js' });
        this.emit('route:Complete', req, res);
        return null;
    }

    return next();
});

module.exports = server.exports();
