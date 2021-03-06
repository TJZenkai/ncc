﻿// NCC Example 3 - get return values

var ncc = require('ncc');

var canvas = ncc(function (err, canvas) {
    if (err) {
        console.error("ncc startup Error:", err);
        return;
    }


    var ctx = canvas.getContext("2d");
    ctx.font = "30px Arial";
    var text = "look how exact this fits"

    ctx.measureText(text)(function (err, val) {
        if (err) {
            console.error("measureText Error:", err);
            return;
        }

        // --- INFO ---
        //  'val' is whatever the function-call would have returned directly in the browser

        console.log("\n\033[46m\t" + "textWidth: '" + val.width + "'" + "\033[49m\n");

        canvas.width = val.width;
        canvas.height = 22;

        ctx.fillStyle = "slateGray";
        ctx.fillRect(0, 0, val.width, 22);

        ctx.font = "30px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(text, 0, 22);

        // --- INFO ---
        //  the callback allways follows the function call:
        //
        //    'canvas.toDataURL()(callback)' not! 'canvas.toDataURL(callback)'

        canvas.toDataURL('image/jpeg', .5)(function (err, val) {
            if (err) {
                console.error("toDataURL Error:", err);
                return;
            }

            console.log("\n\033[46m\t" + "dataURL: '" + val.substring(0, 40) + "...' [length: " + val.length + "]" + "\033[49m\n");
        })
    });
})
