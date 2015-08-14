var svgns = "http://www.w3.org/2000/svg";
var clippedEachLoop = 50;
var loopMax = 1000;
var sampleEvery = 20;
var accumulated = 0;
var samples = [];

var frameHolderTemplate=document.getElementById('frame-holder-template');
var frameTemplate =document.getElementById('frame-template');

document.body.innerHTML = '<svg id="frame-thumbnails" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%"></svg>'


var frameThumbnails = document.getElementById('frame-thumbnails');

buildFrameHolders();

var i = 0;
var intervalId = setInterval(function () {
    //update all the frames by clearing and setting them...
    for (var j=0;j<clippedEachLoop;j++){
        var startTime = Date.now();
        clearFrame(j);
        var endTime = Date.now();
        accumulated += endTime - startTime;
        setFrame(j);
    }
    i++;


    if (i % sampleEvery === 0) {
        console.log(i, accumulated / sampleEvery, 'ms');
        samples.push(accumulated / sampleEvery);
        accumulated = 0;
    }
    if (i >= loopMax) {
        console.log('DONE!');
        console.log(samples);
        clearInterval(intervalId);
    }
}, 45);

function generateDeviceNode(){
    return document.importNode(frameTemplate.content,true);
}

function setFrame(j){
    var frame=document.getElementById('frame-'+j);
    if (!frame)return;
    var deviceNode = generateDeviceNode();
    var contentNode = frame.querySelector('.frame-thumbnail > .frame-body > .content');
    contentNode.appendChild(deviceNode);
}
function clearFrame(j) {
    var frame=document.getElementById('frame-'+j);
    if (!frame)return;
    var device = frame.querySelector('.frame-thumbnail > .frame-body > .content > *');
    if (!device) return;
    device.remove(device.parentNode);
}

//one time
function buildFrameHolders() {
    for (var j = 0; j < clippedEachLoop; j++) {
        //apparently we are supposed to write to template first? weird...
        var t = frameHolderTemplate.content;
        t.querySelector('.frame-thumbnail').setAttribute('id','frame-'+j);
        t.querySelector('.frame-body').setAttribute('transform','translate(' + j*80 + ',0)');
        var holderNode = document.importNode(t,true);
        frameThumbnails.appendChild(holderNode);
    }
}