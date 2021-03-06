﻿// NCC Example 4 - gradients and patterns

var ncc = require('ncc');

var canvas = ncc(function (err, canvas) {
    if (err) {
        console.error("ncc startup Error:", err);
        return;
    }

    canvas.width = 256;
    canvas.height = 256;

    var ctx = canvas.getContext("2d");

    // --- INFO ---
    //  first we fill the canvas with a gray-white gradient from ul to lr

    var grd = ctx.createLinearGradient(0, 0, 256, 256);
    grd.addColorStop(0, "slateGray");
    grd.addColorStop(1, "white");

    ctx.fillStyle = grd;

    ctx.fillRect(0, 0, 256, 256)(function (err, val) {

        if (err) {
            console.error("gradient Error:", err);
            return;
        }

        // --- INFO ---
        //  now we reuse the filled canvas in a pattern and draw it back to canvas

        var pat = ctx.createPattern(canvas, "repeat");
        ctx.rect(0, 0, 256, 256);
        ctx.fillStyle = pat;
        ctx.scale(.1, .1)

        ctx.fill()(function (err, res) {
            if (err) {
                console.error("pattern Error:", err);
                return;
            }

            console.error("\n\033[46m\t" + "Tataa!" + "\033[49m\n");
        });
    });

    //  --- ALTERNATIVES ---
    //  in example 3 you learned return values are accessible through callbacks
    //  this is also true for gradients and patterns:
    //
    //    "ctx.createLinearGradient(0, 0, width, height)(function(err,gra){...)"
    //
    //  but you also have the 'early-access' option allready shown for the initial canvas
    //  in example 2. This is holds for all ncc-proxys-ojects (e.g image, ctx, ...)
})
