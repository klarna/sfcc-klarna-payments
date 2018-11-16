(function () {
    'use strict';

    var Builder = function () {};

    var log = function (name) {
        return 'Abstract method "' + name + '" must be override';
    };

    Builder.prototype.buildRequest = function () {
        throw new Error(log('buildRequest'));
    };

    Builder.prototype.buildResponse = function () {
        throw new Error(log('buildResponse'));
    };

    Builder.prototype.get = function () {
        throw new Error(log('get'));
    };

    module.exports = Builder;
}());
