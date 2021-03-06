﻿// NCC Example 6 - shadow-canvas

var ncc = require('ncc');

// --- INFO ---
//  first we create a shadow-canvas and fill it with a simple stroke pattern

var canvas_shadow = ncc.createCanvas()

canvas_shadow.width = 150;
canvas_shadow.height = 150;

var ctx_shadow = canvas_shadow.getContext("2d");

ctx_shadow.strokeStyle = "slateGrey";

for (var i = 20; i < 150; i += 10) {
    ctx_shadow.lineWidth = i/50;
    ctx_shadow.strokeRect((150 - i) / 2, (150 - i) / 2, i, i);
}

ncc(function (err, canvas_main) {
    if (err) {
        console.error("ncc startup Error:", err);
        return;
    }

    // --- INFO ---
    //  now after startup finished we use the shadow-canvas to draw it on the main-canvas two times 

    canvas_main.width = 256;
    canvas_main.height = 256;

    var ctx_main = canvas_main.getContext("2d");

    ctx_main.save()
    ctx_main.translate(128, 128);
    ctx_main.rotate(Math.PI / 180 * 45)();
    ctx_main.translate(-75, -75);

    ctx_main.drawImage(canvas_shadow, 0, 0)
    ctx_main.restore()

    ctx_main.translate(128, 128);
    ctx_main.rotate(Math.PI / 180 * 90);
    ctx_main.translate(-75, -75);

    ctx_main.drawImage(canvas_shadow, 0, 0);

    // --- INFO ---
    //  to give garbage collection a chance you should nullify all proxy-objects (image, canvas, etc.) that are no longer in use
    //  every proxy-object has a hidden attribute '_remote' taht has to be set to 'null' explicitly:
    
    canvas_shadow = canvas_shadow._remote = null;

    ctx_main(function (err, res) {
        if (err) {
            console.error("shadow canvas Error:", err);
            return;
        }
        console.log("\n\033[46m\t" + "Tataa!" + "\033[49m\n");
    })

    // --- INFO ---
    //  there is no difference between a shadow-canvas and the main-canvas, besides that they are not showing up in the window
})

