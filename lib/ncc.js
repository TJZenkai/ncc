﻿var DEBUG = false;

var spawn = require('child_process').spawn, http = require('http'), fs = require('fs'), ws = require('ws'), os = require('os');

var NCC = (function () {
    var NCC = function (options_, callback_) {
        if (callback_ !== false)
            console.log("\n\033[46m\t" + "[ncc] v0.2.0" + "   \033[49m\n");

        var canvas = NCC.createCanvas(undefined, undefined, true);

        if (typeof (options_) == 'function') {
            callback_ = options_;
            options_ = null;
        }

        var callback = callback_;

        if (options_)
            for (var key in NCC.options)
                if (options_[key] !== undefined)
                    NCC.options[key] = options_[key];

        if (NCC.options.spawn && NCC.chromePid === undefined) {
            NCC.log("[ncc | CP] start", 2);

            var command = NCC.options.spawn.command, args = NCC.options.spawn.args, options = NCC.options.spawn.options;

            var regExp = new RegExp('{(.*?)}'), re;

            for (var i = 0, l = args.length; i < l; i++) {
                re = regExp.exec(args[i]);
                if (re)
                    args[i] = args[i].replace(re[0], NCC.options[re[1].toLowerCase()]);
            }

            NCC.log("[ncc | CP] spawn: " + command + " " + NCC.options.spawn.args.join(" "), 2);

            var chrome = spawn(command, args, options);

            NCC.chromePid = chrome.pid;

            chrome.on('close', function (code) {
                NCC.log('[ncc | CP] exited with code: ' + code, (code !== 0) ? 1 : 2);
                NCC.chromePid = null;
            });

            chrome.stdout.on('data', function (data) {
                NCC.log('[ncc | CP] stdout: ' + data, 2);
            });

            chrome.stderr.on('data', function (data) {
                NCC.log('[ncc | CP] stderr: ' + data, 1);
            });

            chrome.on('error', function (err) {
                NCC.chromePid = null;
                NCC.log("[ncc | CP] error: " + err, 1);
            });
        }

        var url = "http://localhost:" + NCC.options.port + "/json";

        http.get(url, function (res) {
            NCC.log("[ncc | RDP] request started", 2);

            var rdJson = '';

            res.on('data', function (chunk) {
                rdJson += chunk;
            });

            res.on('end', function () {
                NCC.log("[ncc | RDP] request ended", 2);

                var list = JSON.parse(rdJson);

                for (var i = 0, l = list.length; i < l; i++) {
                    if (list[i].title == "ncc" && list[i].webSocketDebuggerUrl) {
                        Object.defineProperties(rdp, {
                            ws: {
                                value: new ws(list[i].webSocketDebuggerUrl)
                            }
                        });

                        rdp.ws.on('open', function () {
                            NCC.log("[ncc | RDP] session established", 2);

                            rdp(function (err, res) {
                                if (err)
                                    NCC.log("[ncc] error: " + err.message, 1);
                                if (callback)
                                    err ? callback(err, null) : callback(null, canvas, rdp);
                            });
                        });

                        rdp.ws.on('close', function () {
                            NCC.log("[ncc | RDP] session closed", 1);
                        });
                        return;
                    } else {
                        NCC.log("[ncc | RDP] remote not found" + ((NCC.options.retry) ? " - retry " + NCC.options.retry : ""), 1);
                        if (NCC.options.retry--)
                            setTimeout(NCC, NCC.options.retryDelay, callback, false);
                        else if (callback)
                            callback("remote not found");
                    }
                }
            });
        }).on('error', function (err) {
            NCC.log("[ncc | RDP] request denied" + ((NCC.options.retry) ? " - retry " + NCC.options.retry : ""), 1);
            if (NCC.options.retry--)
                setTimeout(NCC, NCC.options.retryDelay, callback, false);
            else if (callback)
                callback(err.message, null);
        });

        return canvas;
    };

    Object.defineProperties(NCC, {
        options: {
            enumerable: true,
            writable: true,
            value: {
                logLevel: 2,
                port: 9222,
                retry: 3,
                retryDelay: 1000,
                spawn: {
                    command: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    args: [
                        '--app=' + __dirname + '\\index.html',
                        '--remote-debugging-port={PORT}',
                        '--user-data-dir=' + os.tmpdir() + '\\nccanvas'
                    ],
                    options: {}
                }
            }
        },
        createCanvas: {
            enumerable: true,
            value: function (width, height, main) {
                if (!main) {
                    var uid = NCC.uid('canvas');
                    rdp("var " + uid + " = document.createElement('canvas')");
                }

                var canvas = function (callback) {
                    rdp(callback ? function (err, res) {
                        err ? callback(err, null) : callback(null, canvas);
                    } : undefined);
                    return canvas;
                };

                CanvasPDM["_uid"].value = main ? 'canvas' : uid;
                Object.defineProperties(canvas, CanvasPDM);
                CanvasPDM["_uid"].value = "";

                canvas.width = width;
                canvas.height = height;

                return canvas;
            }
        },
        createImage: {
            enumerable: true,
            value: function (src, onload, onerror) {
                var uid = NCC.uid('image');
                rdp("var " + uid + " = new Image()");
                var image = function (callback) {
                    rdp(callback ? function (err, res) {
                        err ? callback(err, null) : callback(null, image);
                    } : undefined);
                    return image;
                };

                ImagePDM["_uid"].value = uid;
                Object.defineProperties(image, ImagePDM);
                ImagePDM["_uid"].value = "";

                image.src = src;
                image.onload = onload;
                image.onerror = onerror;

                return image;
            }
        },
        uid: {
            enumerable: false,
            value: function (type) {
                return type + "_" + Math.random().toString(36).slice(2);
            }
        },
        log: {
            enumerable: false,
            value: function (msg, level) {
                if (!level || (level <= this.options.logLevel))
                    console.log(msg);
            }
        }
    });

    return NCC;
})();

// RDP | Remote Debugging Protocol (the bridge to chrome)
var rdp = (function () {
    var rdp = function (_) {
        if (typeof _ == 'string') {
            if (NCC.options.logLevel >= 3)
                console.log("+ \033[33m" + _ + "\033[39m");
            rdp.cmd += _ + ";";
            return rdp;
        }

        if (_ !== null) {
            rdp.queue.push({
                cmd: rdp.cmd,
                callback: _
            });
            rdp.cmd = "";
        }

        if (!rdp.queue[0] || rdp.req == rdp.queue[0] || !rdp.ws)
            return rdp;

        rdp.req = rdp.queue[0];

        if (NCC.options.logLevel >= 3)
            console.log("> \033[32m" + rdp.req.cmd.split(';').slice(0, -1).join(';\n  ') + "\033[39m");

        rdp.ws.send('{"id":0,"method":"Runtime.evaluate", "params":{"expression":"' + rdp.req.cmd + '"}}');
        rdp.ws.once('message', function (data) {
            data = JSON.parse(data);

            if (NCC.options.logLevel >= 3)
                console.log("<\033[35m", data.error || data.result, "\033[39m");

            var err = data.error || data.result.wasThrown ? data.result.result.description : null, res = err ? null : data.result.result;

            if (rdp.req.callback)
                rdp.req.callback(err, res);
            rdp.req = rdp.queue.shift();
            rdp(null);
        });

        return rdp;
    };

    Object.defineProperties(rdp, {
        cmd: {
            enumerable: DEBUG,
            writable: true,
            value: ""
        },
        queue: {
            enumerable: DEBUG,
            value: []
        }
    });

    return rdp;
})();




var CanvasPDM = (function () {
    return {
        // private properties
        _uid: {
            configurable: true,
            enumerable: DEBUG,
            value: "canvas"
        },
        _remote: {
            enumerable: DEBUG,
            set: function (null_) {
                if (null_ === null) {
                    if (this._uid == "canvas")
                        throw new Error("you cannot delete the main canvas");
                    rdp(this._uid + " = null");
                    Object.defineProperty(this, '_uid', { value: null });
                    this._ctx = null;
                } else
                    throw new Error("'_remote' can only be set to 'null'");
            }
        },
        _ctx: {
            enumerable: DEBUG,
            writable: true,
            value: null
        },
        // Properties || proxies with defaults
        width_: {
            enumerable: DEBUG,
            writable: true,
            value: 300
        },
        height_: {
            enumerable: DEBUG,
            writable: true,
            value: 150
        },
        // Web API: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement
        // Properties || getters/setters || https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement#Properties
        width: {
            enumerable: true,
            get: function () {
                return this.width_;
            },
            set: function (width) {
                if (width === undefined)
                    return;
                rdp(this._uid + '.width = ' + width);
                return this.width_ = width;
            }
        },
        height: {
            enumerable: true,
            get: function () {
                return this.height_;
            },
            set: function (height) {
                if (height === undefined)
                    return;
                rdp(this._uid + '.height = ' + height);
                return this.height_ = height;
            }
        },
        // Methods || https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement#Methods
        getContext: {
            enumerable: true,
            value: function (contextId) {
                if (contextId == "2d") {
                    var uid = NCC.uid('context2d');
                    rdp("var " + uid + " = " + this._uid + ".getContext('2d')");

                    var context2d = function (callback) {
                        rdp(callback ? function (err, res) {
                            err ? callback(err, null) : callback(null, context2d);
                        } : undefined);
                        return context2d;
                    };

                    context2dPDM["_uid"].value = uid;
                    context2dPDM["canvas"].value = this;
                    Object.defineProperties(context2d, context2dPDM);
                    context2dPDM["_uid"].value = "";

                    return context2d;
                }

                throw new Error(contextId + " is not implemented");
            }
        },
        toDataURL: {
            enumerable: true,
            value: function (type, args) {
                rdp(this._uid + ".toDataURL(" + (("'" + type + "'") || "") + ")");

                return function (callback) {
                    rdp(function (err, res) {
                        if (err)
                            return callback(err, null);
                        callback(err, res.value);
                    });
                };
            }
        }
    };
})();


var context2dPDM = (function () {
    return {
        // private properties
        _uid: {
            enumerable: DEBUG,
            value: ""
        },
        _remote: {
            enumerable: DEBUG,
            set: function (null_) {
                if (null_ === null) {
                    rdp(this._uid + " = null");
                    Object.defineProperty(this, '_uid', { value: null });
                } else
                    throw new Error("'_remote' can only be set to 'null'");
            }
        },
        // Attributes || proxies with defaults
        fillStyle_: { writable: true, enumerable: DEBUG, value: '#000000' },
        font_: { writable: true, enumerable: DEBUG, value: '10px sans-serif' },
        globalAlpha_: { writable: true, enumerable: DEBUG, value: 1.0 },
        globalCompositeOperation_: { writable: true, enumerable: DEBUG, value: 'source-over' },
        lineCap_: { writable: true, enumerable: DEBUG, value: 'butt' },
        lineDashOffset_: { writable: true, enumerable: DEBUG, value: 0 },
        lineJoin_: { writable: true, enumerable: DEBUG, value: 'miter' },
        lineWidth_: { writable: true, enumerable: DEBUG, value: 1.0 },
        miterLimit_: { writable: true, enumerable: DEBUG, value: 10 },
        shadowBlur_: { writable: true, enumerable: DEBUG, value: 0 },
        shadowColor_: { writable: true, enumerable: DEBUG, value: 'rgba(0, 0, 0, 0)' },
        shadowOffsetX_: { writable: true, enumerable: DEBUG, value: 0 },
        shadowOffsetY_: { writable: true, enumerable: DEBUG, value: 0 },
        strokeStyle_: { writable: true, enumerable: DEBUG, value: '#000000' },
        textAlign_: { writable: true, enumerable: DEBUG, value: 'start' },
        textBaseline_: { writable: true, enumerable: DEBUG, value: 'alphabetic' },
        webkitBackingStorePixelRatio_: { writable: true, enumerable: DEBUG, value: 1 },
        webkitImageSmoothingEnabled_: { writable: true, enumerable: DEBUG, value: true },
        // Web API: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingcontext2d
        // Attributes || getters/setters || https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingcontext2d#Attributes
        canvas: {
            enumerable: true, value: null
        },
        fillStyle: {
            enumerable: true, get: function () {
                return this.fillStyle_;
            },
            set: function (fillStyle) {
                rdp(this._uid + ".fillStyle = " + (fillStyle._uid || ("'" + fillStyle + "'")));
                return this.fillStyle_ = fillStyle;
            }
        },
        font: {
            enumerable: true, get: function () {
                return this.font_;
            },
            set: function (font) {
                rdp(this._uid + ".font = '" + font + "'");
                return this.font_ = font;
            }
        },
        globalAlpha: {
            enumerable: true, get: function () {
                return this.globalAlpha_;
            },
            set: function (globalAlpha) {
                rdp(this._uid + ".globalAlpha = " + globalAlpha);
                return this.globalAlpha_ = globalAlpha;
            }
        },
        globalCompositeOperation: {
            enumerable: true, get: function () {
                return this.globalCompositeOperation_;
            },
            set: function (globalCompositeOperation) {
                rdp(this._uid + ".globalCompositeOperation = '" + globalCompositeOperation + "'");
                return this.globalCompositeOperation_ = globalCompositeOperation;
            }
        },
        lineCap: {
            enumerable: true, get: function () {
                return this.lineCap_;
            },
            set: function (lineCap) {
                rdp(this._uid + ".lineCap = '" + lineCap + "'");
                return this.lineCap_ = lineCap;
            }
        },
        lineDashOffset: {
            enumerable: true, get: function () {
                return this.lineDashOffset_;
            },
            set: function (lineDashOffset) {
                rdp(this._uid + ".lineDashOffset = " + lineDashOffset);
                return this.lineDashOffset_ = lineDashOffset;
            }
        },
        lineJoin: {
            enumerable: true, get: function () {
                return this.lineJoin_;
            },
            set: function (lineJoin) {
                rdp(this._uid + ".lineJoin = '" + lineJoin + "'");
                return this.lineJoin_ = lineJoin;
            }
        },
        lineWidth: {
            enumerable: true, get: function () {
                return this.lineWidth_;
            },
            set: function (lineWidth) {
                rdp(this._uid + ".lineWidth = " + lineWidth);
                return this.lineWidth_ = lineWidth;
            }
        },
        miterLimit: {
            enumerable: true, get: function () {
                return this.miterLimit_;
            },
            set: function (miterLimit) {
                rdp(this._uid + ".miterLimit = " + miterLimit);
                return this.miterLimit_ = miterLimit;
            }
        },
        shadowBlur: {
            enumerable: true, get: function () {
                return this.shadowBlur_;
            },
            set: function (shadowBlur) {
                rdp(this._uid + ".shadowBlur = " + shadowBlur);
                return this.shadowBlur_ = shadowBlur;
            }
        },
        shadowColor: {
            enumerable: true, get: function () {
                return this.shadowColor;
            },
            set: function (shadowColor) {
                rdp(this._uid + ".shadowColor = '" + shadowColor + "'");
                return this.shadowColor_ = shadowColor;
            }
        },
        shadowOffsetX: {
            enumerable: true, get: function () {
                return this.shadowOffsetX_;
            },
            set: function (shadowOffsetX) {
                rdp(this._uid + ".shadowOffsetX = " + shadowOffsetX);
                return this.shadowOffsetX_ = shadowOffsetX;
            }
        },
        shadowOffsetY: {
            enumerable: true, get: function () {
                return this.shadowOffsetY_;
            },
            set: function (shadowOffsetY) {
                rdp(this._uid + ".shadowOffsetY = " + shadowOffsetY);
                return this.shadowOffsetY_ = shadowOffsetY;
            }
        },
        strokeStyle: {
            enumerable: true, get: function () {
                return this.strokeStyle_;
            },
            set: function (strokeStyle) {
                rdp(this._uid + ".strokeStyle = " + (strokeStyle._uid || ("'" + strokeStyle + "'")));
                return this.strokeStyle_ = strokeStyle;
            }
        },
        textAlign: {
            enumerable: true, get: function () {
                return this.textAlign_;
            },
            set: function (textAlign) {
                rdp(this._uid + ".textAlign = '" + textAlign + "'");
                return this.textAlign_ = textAlign;
            }
        },
        textBaseline: {
            enumerable: true, get: function () {
                return this.textBaseline_;
            },
            set: function (textBaseline) {
                rdp(this._uid + ".textBaseline = '" + textBaseline + "'");
                return this.textBaseline_ = textBaseline;
            }
        },
        webkitBackingStorePixelRatio: {
            enumerable: true, get: function () {
                return this.webkitBackingStorePixelRatio_;
            },
            set: function (webkitBackingStorePixelRatio) {
                rdp(this._uid + ".webkitBackingStorePixelRatio = " + webkitBackingStorePixelRatio);
                return this.webkitBackingStorePixelRatio_ = webkitBackingStorePixelRatio;
            }
        },
        webkitImageSmoothingEnabled: {
            enumerable: true, get: function () {
                return this.webkitImageSmoothingEnabled_;
            },
            set: function (webkitImageSmoothingEnabled) {
                rdp(this._uid + ".webkitImageSmoothingEnabled = " + webkitImageSmoothingEnabled);
                return this.webkitImageSmoothingEnabled_ = webkitImageSmoothingEnabled;
            }
        },
        // Methods || https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingcontext2d#Methods
        arc: {
            enumerable: true,
            value: function (x, y, radius, startAngle, endAngle, anticlockwise) {
                return rdp(this._uid + ".arc(" + (Array.prototype.slice.call(arguments, 0).join(',')) + ")");
            }
        },
        arcTo: {
            enumerable: true,
            value: function (x1, y1, x2, y2, radius) {
                return rdp(this._uid + ".arcTo(" + x1 + ", " + y1 + ", " + x2 + ", " + y2 + ", " + radius + ")");
            }
        },
        beginPath: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".beginPath()");
            }
        },
        bezierCurveTo: {
            enumerable: true,
            value: function (cp1x, cp1y, cp2x, cp2y, x, y) {
                return rdp(this._uid + ".bezierCurveTo(" + cp1x + ", " + cp1y + ", " + cp2x + ", " + cp2y + ", " + x + ", " + y + ")");
            }
        },
        clearRect: {
            enumerable: true,
            value: function (x, y, width, height) {
                return rdp(this._uid + ".clearRect(" + x + ", " + y + ", " + width + ", " + height + ")");
            }
        },
        clip: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".clip()");
            }
        },
        closePath: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".closePath()");
            }
        },
        createImageData: {
            enumerable: true,
            value: function (width, height) {
                if (width.height != undefined) {
                    height = width.height;
                    width = width.width;
                }

                return function (callback) {
                    callback(null, {
                        data: new Uint8ClampedArray(Array.apply(null, new Array(width * height * 4)).map(Number.prototype.valueOf, 0)),
                        width: width,
                        height: height
                    });
                };
            }
        },
        createLinearGradient: {
            enumerable: true,
            value: function (x0, y0, x1, y1) {
                var uid = NCC.uid('linearGradient');
                rdp("var " + uid + " = " + this._uid + ".createLinearGradient(" + x0 + ", " + y0 + ", " + x1 + ", " + y1 + ")");

                var linearGradient = function (callback) {
                    rdp(callback ? function (err, res) {
                        err ? callback(err, null) : callback(null, linearGradient);
                    } : undefined);
                    return linearGradient;
                };

                GradientPDM["_uid"].value = uid;
                Object.defineProperties(linearGradient, GradientPDM);
                GradientPDM["_uid"].value = "";

                return linearGradient;
            }
        },
        createPattern: {
            enumerable: true,
            value: function (image, repetition) {
                var uid = NCC.uid('pattern');
                rdp("var " + uid + " = " + this._uid + ".createPattern(" + image._uid + ", '" + repetition + "')");

                var pattern = function (callback) {
                    rdp(callback ? function (err, res) {
                        err ? callback(err, null) : callback(null, pattern);
                    } : undefined);
                    return pattern;
                };

                PatternPDM["_uid"].value = uid;
                Object.defineProperties(pattern, PatternPDM);
                PatternPDM["_uid"].value = "";

                return pattern;
            }
        },
        createRadialGradient: {
            enumerable: true,
            value: function (x0, y0, r0, x1, y1, r1) {
                var uid = NCC.uid('pattern');
                rdp("var " + uid + " = " + this._uid + ".createRadialGradient(" + x0 + ", " + y0 + ", " + r0 + ", " + x1 + ", " + y1 + ", " + r1 + ")");

                var radialGradient = function (callback) {
                    rdp(callback ? function (err, res) {
                        err ? callback(err, null) : callback(null, radialGradient);
                    } : undefined);
                    return radialGradient;
                };

                GradientPDM["_uid"].value = NCC.uid('radialGradient');
                Object.defineProperties(radialGradient, GradientPDM);
                GradientPDM["_uid"].value = "";

                return radialGradient;
            }
        },
        drawImage: {
            enumerable: true,
            value: function (image, a1, a2, a3, a4, a5, a6, a7, a8) {
                return rdp(this._uid + ".drawImage(" + image._uid + ", " + (Array.prototype.slice.call(arguments, 1).join(',')) + ")");
            }
        },
        // no use
        //drawCustomFocusRing: { //RETURN/ boolean //IN/ Element element
        //    enumerable:true,
        //    value: function (element) {
        //        rdp(this._uid + ".drawCustomFocusRing(" + element + ")");
        //        return this;
        //    }
        //},
        // no use
        //drawSystemFocusRing: { //RETURN/ void //IN/ Element element
        //    enumerable:true,
        //    value: function (element) {
        //        rdp(this._uid + ".drawSystemFocusRinelementg()");
        //        return this;
        //    }
        //},
        fill: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".fill()");
            }
        },
        fillRect: {
            enumerable: true,
            value: function (x, y, width, height) {
                return rdp(this._uid + ".fillRect(" + x + ", " + y + ", " + width + ", " + height + ")");
            }
        },
        fillText: {
            enumerable: true,
            value: function (text, x, y, maxWidth) {
                return rdp(this._uid + ".fillText('" + text + "', " + (Array.prototype.slice.call(arguments, 1).join(',')) + ")");
            }
        },
        getImageData: {
            enumerable: true,
            value: function (x, y, width, height) {
                rdp("Array.prototype.slice.call(" + this._uid + ".getImageData(" + x + "," + y + "," + width + "," + height + ").data).join(',')");
                return function (callback) {
                    rdp(function (err, res) {
                        if (err)
                            return callback(err, null);

                        var imageData = {
                            data: new Uint8ClampedArray(res.value.split(',')),
                            width: width,
                            height: height
                        };

                        callback(null, imageData);
                    });
                };
            }
        },
        getLineDash: {
            enumerable: true,
            value: function () {
                rdp(this._uid + ".getLineDash().join(',')");
                return function (callback) {
                    rdp(function (err, res) {
                        if (err)
                            return callback(err);

                        res.value = res.value.split(',');
                        for (var i = 0, l = res.value.length; i < l; i++)
                            res.value[i] = +res.value[i];

                        callback(err, res.value);
                    });
                };
            }
        },
        isPointInPath: {
            enumerable: true,
            value: function (x, y) {
                rdp(this._uid + ".isPointInPath(" + x + ", " + y + ")");
                return function (callback) {
                    rdp(function (err, res) {
                        callback(err, res.value);
                    });
                };
            }
        },
        isPointInStroke: {
            enumerable: true,
            value: function (x, y) {
                rdp(this._uid + ".isPointInStroke(" + x + ", " + y + ")");
                return function (callback) {
                    rdp(function (err, res) {
                        callback(err, res.value);
                    });
                };
            }
        },
        lineTo: {
            enumerable: true,
            value: function (x, y) {
                return rdp(this._uid + ".lineTo(" + x + ", " + y + ")");
            }
        },
        measureText: {
            enumerable: true,
            value: function (text) {
                rdp(this._uid + ".measureText('" + text + "').width");
                return function (callback) {
                    rdp(function (err, res) {
                        if (err)
                            return callback(err);

                        callback(null, { width: res.value });
                    });
                };
            }
        },
        moveTo: {
            enumerable: true,
            value: function (x, y) {
                return rdp(this._uid + ".moveTo(" + x + ", " + y + ")");
            }
        },
        putImageData: {
            enumerable: true,
            value: function (imagedata, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight) {
                return rdp("var data = [" + Array.prototype.slice.call(imagedata.data).join(',') + "]; var iD = " + this._uid + ".createImageData(" + imagedata.width + ", " + imagedata.height + "); for (var i = 0, l = iD.data.length; i < l; i++) iD.data[i] = +data[i]; " + this._uid + ".putImageData(iD, " + (Array.prototype.slice.call(arguments, 1).join(',')) + ")");
            }
        },
        quadraticCurveTo: {
            enumerable: true,
            value: function (cpx, cpy, x, y) {
                return rdp(this._uid + ".quadraticCurveTo(" + cpx + ", " + cpy + ", " + x + ", " + y + ")");
            }
        },
        rect: {
            enumerable: true,
            value: function (x, y, width, height) {
                return rdp(this._uid + ".rect(" + x + ", " + y + ", " + width + ", " + height + ")");
            }
        },
        restore: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".restore()");
            }
        },
        rotate: {
            enumerable: true,
            value: function (angle) {
                return rdp(this._uid + ".rotate(" + angle + ")");
            }
        },
        save: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".save()");
            }
        },
        scale: {
            enumerable: true,
            value: function (x, y) {
                return rdp(this._uid + ".scale(" + x + ", " + y + ")");
            }
        },
        // no use
        //scrollPathIntoView: { //RETURN/ void //IN/
        //    enumerable: true,
        //    value: function () {
        //        rdp(this._uid + ".scrollPathIntoView()");
        //        return this;
        //    }
        //},
        setLineDash: {
            enumerable: true,
            value: function (segments) {
                return rdp(this._uid + ".setLineDash([" + segments.join(',') + "])");
            }
        },
        setTransform: {
            enumerable: true,
            value: function (m11, m12, m21, m22, dx, dy) {
                return rdp(this._uid + ".setTransform(" + m11 + ", " + m12 + ", " + m21 + ", " + m22 + ", " + dx + ", " + dy + ")");
            }
        },
        stroke: {
            enumerable: true,
            value: function () {
                return rdp(this._uid + ".stroke()");
            }
        },
        strokeRect: {
            enumerable: true,
            value: function (x, y, w, h) {
                return rdp(this._uid + ".strokeRect(" + x + ", " + y + ", " + w + ", " + h + ")");
            }
        },
        strokeText: {
            enumerable: true,
            value: function (text, x, y, maxWidth) {
                rdp(this._uid + ".strokeText('" + text + "', " + (Array.prototype.slice.call(arguments, 1).join(',')) + ")");
                return this;
            }
        },
        transform: {
            enumerable: true,
            value: function (m11, m12, m21, m22, dx, dy) {
                return rdp(this._uid + ".transform(" + m11 + ", " + m12 + ", " + m21 + ", " + m22 + ", " + dx + ", " + dy + ")");
            }
        },
        translate: {
            enumerable: true,
            value: function (x, y) {
                return rdp(this._uid + ".translate(" + x + ", " + y + ")");
            }
        }
    };
})();


var GradientPDM = (function () {
    return {
        // private properties
        _uid: {
            enumerable: DEBUG,
            value: ""
        },
        _remote: {
            enumerable: DEBUG,
            set: function (null_) {
                if (null_ === null) {
                    rdp(this._uid + " = null");
                    Object.defineProperty(this, '_uid', { value: null });
                } else
                    throw new Error("'_remote' can only be set to 'null'");
            }
        },
        // Web API: https://developer.mozilla.org/en-US/docs/Web/API/CanvasGradient
        // Methods
        addColorStop: {
            enumerable: true,
            value: function (offset, color) {
                return rdp(this._uid + ".addColorStop(" + offset + ", '" + color + "')");
            }
        }
    };
})();


var PatternPDM = (function () {
    return {
        // private properties
        _uid: {
            enumerable: DEBUG,
            value: ""
        },
        _remote: {
            enumerable: DEBUG,
            set: function (null_) {
                if (null_ === null) {
                    rdp(this._uid + " = null");
                    Object.defineProperty(this, '_uid', { value: null });
                } else
                    throw new Error("'_remote' can only be set to 'null'");
            }
        }
    };
})();


var mimeMap = {
    png: 'image/png',
    webp: 'image/webp',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    svg: 'image/svg+xml',
    gif: 'image/gif'
};

var regExp_http = new RegExp('^(http:\\/\\/.+)', 'i');
var regExp_data = new RegExp('^(data:image\\/\\w+;base64,.+)');
var regExp_type = new RegExp('^data:image\\/(\\w+);base64,');

var ImagePDM = (function () {
    return {
        // private properties
        _uid: {
            enumerable: DEBUG,
            value: ""
        },
        _remote: {
            enumerable: DEBUG,
            set: function (null_) {
                if (null_ === null) {
                    rdp(this._uid + " = null");
                    Object.defineProperty(this, '_uid', { value: null });
                } else
                    throw new Error("'_remote' can only be set to 'null'");
            }
        },
        // Properties
        src_: {
            enumerable: DEBUG,
            writable: true,
            value: ""
        },
        width_: {
            enumerable: DEBUG,
            writable: true,
            value: undefined
        },
        height_: {
            enumerable: DEBUG,
            writable: true,
            value: undefined
        },
        _base64_: {
            enumerable: DEBUG,
            writable: true,
            value: null
        },
        _base64: {
            enumerable: DEBUG,
            get: function () {
                return this._base64_;
            },
            set: function (base64) {
                var img = this;
                rdp(this._uid + ".src = " + "'" + base64 + "';" + this._uid + ".width+'_'+" + this._uid + ".height");
                rdp(function (err, res) {
                    if (err && img.onerror)
                        return img.onerror(err);

                    var size = res.value.split('_');
                    img.width_ = +size[0];
                    img.height_ = +size[1];

                    if (img.onload)
                        return img.onload(img);
                });

                this._base64_ = base64;
                return this._base64_;
            }
        },
        // Methods
        _toFile: {
            enumerable: DEBUG,
            value: function (filename, callback) {
                var head = regExp_type.exec(this._base64_), type = filename.split('.').pop();

                if (!head || !head[1] || (head[1] != ((type == "jpg") ? "jpeg" : type)))
                    if (callback)
                        return callback("type mismatch " + (head ? head[1] : "'unknown'") + " !> " + type);
                    else
                        throw new Error("type mismatch " + (head ? head[1] : "'unknown'") + " !> " + type);

                NCC.log('[ncc] writing image to: ' + filename, 2);
                fs.writeFile(filename, new Buffer(this._base64_.replace(/^data:image\/\w+;base64,/, ""), 'base64'), {}, callback);
            }
        },
        // Web API
        // Properties
        src: {
            enumerable: true,
            get: function () {
                return this.src_;
            },
            set: function (src) {
                var img = this;
                this._src = src;
                if (!src || src === "")
                    return;

                if (regExp_data.test(src))
                    img._base64 = src;
                else if (regExp_http.test(src)) {
                    NCC.log('[ncc] loading image from URL: ' + src, 2);
                    http.get(src, function (res) {
                        var data = '';
                        res.setEncoding('base64');

                        if (res.statusCode != 200) {
                            if (img.onerror)
                                return img.onerror("loading image failed with status " + res.statusCode);
                            else
                                throw new Error("loading image failed with status " + res.statusCode);
                        }

                        res.on('data', function (chunk) {
                            data += chunk;
                        });

                        res.on('end', function () {
                            img._base64 = "data:" + (res.headers["content-type"] || mimeMap[src.split('.').pop()]) + ";base64," + data;
                            NCC.log('[ncc] loading image from URL completed', 2);
                        });
                    }).on('error', this.onerror || function (err) {
                        if (img.onerror)
                            return img.onerror(err);
                        else
                            throw err;
                    });
                } else {
                    NCC.log('[ncc] loading image from FS: ' + src, 2);
                    fs.readFile(src, 'base64', function (err, data) {
                        if (err) {
                            if (img.onerror)
                                img.onerror(err);
                            else
                                throw err;
                        }
                        img._base64 = "data:" + mimeMap[src.split('.').pop()] + ";base64," + data;
                        NCC.log('[ncc] loading image from FS completed', 2);
                    });
                }
                return this.src_;
            }
        },
        onload: {
            writable: true,
            enumerable: true,
            value: undefined
        },
        onerror: {
            writable: true,
            enumerable: true,
            value: undefined
        },
        width: {
            enumerable: true,
            get: function () {
                return this.width_;
            }
        },
        height: {
            enumerable: true,
            get: function () {
                return this.height_;
            }
        }
    };
})();

module.exports = NCC;
