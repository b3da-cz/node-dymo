"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeDymo = exports.NODE_DYMO_SYSTEM = void 0;
var events_1 = require("events");
var usb_1 = require("usb");
var selectors = {
    isScaleIdle: function (dataArr) { return dataArr[1] === 2; },
    isScaleWeighting: function (dataArr) { return dataArr[1] === 3; },
    isScaleReady: function (dataArr) { return dataArr[1] === 4; },
    isScaleOverweight: function (dataArr) { return dataArr[1] === 6; },
    isScaleSystemOunces: function (dataArr) { return dataArr[2] === 12; },
    isScaleSystemGrams: function (dataArr) { return dataArr[2] === 3; },
};
var NODE_DYMO_VENDOR_ID = 2338;
exports.NODE_DYMO_SYSTEM = {
    GRAMS: 'grams',
    OUNCES: 'ounces',
};
var NodeDymo = /** @class */ (function () {
    function NodeDymo() {
        this.isReady = false;
        this.weight = {
            value: 0,
            isOverweight: false,
            system: exports.NODE_DYMO_SYSTEM.GRAMS,
        };
        this.emitter = new events_1.EventEmitter();
    }
    NodeDymo.prototype.init = function (productId) {
        var _this = this;
        if (productId === void 0) { productId = null; }
        this.listenForScaleConnectionEvents();
        this.findScale(productId).then(function (foundDevice) {
            return _this.connectScale(foundDevice);
        }).then(function (connectedDevice) {
            return _this.listenToScaleUpdates(connectedDevice);
        }).catch(function (err) {
            _this.isReady = false;
            _this.emitter.emit('end', err.message);
        });
    };
    NodeDymo.prototype.on = function (event, callback) {
        this.emitter.on(event, callback);
    };
    NodeDymo.prototype.getWeight = function () {
        return this.weight;
    };
    Object.defineProperty(NodeDymo.prototype, "isScaleReady", {
        get: function () {
            return this.isReady;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NodeDymo.prototype, "isScaleOverweight", {
        get: function () {
            return this.weight.isOverweight;
        },
        enumerable: false,
        configurable: true
    });
    NodeDymo.prototype.listenForScaleConnectionEvents = function () {
        var _this = this;
        usb_1.usb.on('attach', function (device) {
            if (device.deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
                _this.init(String(device.deviceDescriptor.idProduct));
                _this.emitter.emit('online');
            }
        });
        usb_1.usb.on('detach', function (device) {
            if (device.deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
                _this.isReady = false;
                _this.emitter.emit('offline');
            }
        });
    };
    NodeDymo.prototype.findScale = function (productId) {
        if (productId === void 0) { productId = null; }
        return new Promise(function (resolve, reject) {
            var allUsbDevices = [];
            var dymoUsbDevices = [];
            if (!!productId && (0, usb_1.findByIds)(NODE_DYMO_VENDOR_ID, Number(productId))) {
                return resolve((0, usb_1.findByIds)(NODE_DYMO_VENDOR_ID, Number(productId)));
            }
            else {
                allUsbDevices = (0, usb_1.getDeviceList)();
                for (var i = 0; i < allUsbDevices.length; i++) {
                    if (allUsbDevices[i].deviceDescriptor.idVendor === NODE_DYMO_VENDOR_ID) {
                        dymoUsbDevices.push(allUsbDevices[i]);
                    }
                }
                if (dymoUsbDevices.length > 1) {
                    return reject('ERROR: Specify productId! (more than one Dymo scale)');
                }
                else if (dymoUsbDevices.length === 0) {
                    return reject('ERROR: No Dymo scales!');
                }
                else {
                    return resolve(dymoUsbDevices[0]);
                }
            }
        });
    };
    NodeDymo.prototype.connectScale = function (device) {
        return new Promise(function (resolve, reject) {
            try {
                device.open();
                device.reset(function () {
                    if (device.interface(0).isKernelDriverActive()) {
                        device.interface(0).detachKernelDriver();
                    }
                    device.interface(0).claim();
                    return resolve(device);
                });
            }
            catch (e) {
                return reject("ERROR: ".concat(e.message));
            }
        });
    };
    NodeDymo.prototype.listenToScaleUpdates = function (device) {
        var _this = this;
        device.interface(0).endpoint(130).startPoll(3, 6);
        this.isReady = true;
        device.interface(0).endpoint(130).on('error', function (data) {
            _this.isReady = false;
            _this.emitter.emit('end', data);
        });
        device.interface(0).endpoint(130).on('end', function (data) {
            _this.isReady = false;
            _this.emitter.emit('end', data);
            device.interface(0).endpoint(130).stopPoll();
        });
        device.interface(0).endpoint(130).on('data', function (data) {
            var buffer = data.toJSON();
            var dataArr = Object.keys(buffer).includes('data') ? buffer.data : buffer;
            var isOverweight = false;
            var value = 0;
            var system = exports.NODE_DYMO_SYSTEM.GRAMS;
            if (selectors.isScaleIdle(dataArr)) {
                isOverweight = false;
                value = 0;
            }
            if (selectors.isScaleSystemOunces(dataArr)) {
                system = exports.NODE_DYMO_SYSTEM.OUNCES;
            }
            if (selectors.isScaleSystemGrams(dataArr)) {
                system = exports.NODE_DYMO_SYSTEM.GRAMS;
            }
            if (selectors.isScaleReady(dataArr) && system === exports.NODE_DYMO_SYSTEM.OUNCES) {
                isOverweight = false;
                value = Math.round(((dataArr[4] + (dataArr[5] * 256)) * 0.1) * 100);
            }
            if (selectors.isScaleReady(dataArr) && system === exports.NODE_DYMO_SYSTEM.GRAMS) {
                isOverweight = false;
                value = Math.round((dataArr[4] + dataArr[5] * 256) * 100);
            }
            if (selectors.isScaleOverweight(dataArr)) {
                isOverweight = true;
                value = 0;
            }
            if (_this.weight.value !== value) {
                _this.weight.value = value;
                _this.weight.system = system;
                _this.emitter.emit('weight-change', { value: value, system: system });
                _this.emitter.emit('weight', _this.weight);
            }
            if (_this.weight.isOverweight !== isOverweight) {
                _this.weight.isOverweight = isOverweight;
                _this.emitter.emit('overweight-change', isOverweight);
                _this.emitter.emit('weight', _this.weight);
            }
        });
    };
    return NodeDymo;
}());
exports.NodeDymo = NodeDymo;
