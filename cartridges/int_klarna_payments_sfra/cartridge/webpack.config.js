/* globals cat, cd, cp, echo, exec, exit, find, ls, mkdir, rm, target, test */
'use strict';

require('shelljs/make');
var path = require('path');

module.exports = [{
    mode: 'production',
    name: 'js',
    entry: {
        'klarna-payments': path.join(__dirname, '/client/js/default/klarna-payments.js')
    },
    output: {
        path: path.resolve('./static/default/js/'),
        filename: '[name].js'
    }
}];
