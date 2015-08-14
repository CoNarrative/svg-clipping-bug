var svgns = "http://www.w3.org/2000/svg";
var framesInStory = 10;
var numberOfUpdates = 10;
var sampleEvery = 1;
var accumulated = 0;
var samples = [];

var frameHolderTemplate=document.getElementById('frame-holder-template');
var frameTemplate =document.getElementById('frame-template');
//remove from template
var clipPaths = frameTemplate.content.querySelectorAll('clipPath');
var clipPathsById = _.indexBy(clipPaths,'id');
var clipped = frameTemplate.content.querySelectorAll('*[clip-path]');
var clippedById = _.groupBy(clipped,function(el){
    var c = el.getAttribute('clip-path');
    return c.substring(5, c.length-1)});

console.log(clipPathsById, clippedById,'clipped groups')



document.body.innerHTML = '<svg id="frame-thumbnails" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%"></svg>'


var frameThumbnails = document.getElementById('frame-thumbnails');

buildFrameHolders();

var i = 0;
var intervalId = setInterval(function () {
    //update all the frames by clearing and setting them...
    for (var j=0;j<framesInStory;j++){
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
    if (i >= numberOfUpdates) {
        console.log('DONE!');
        console.log(samples);
        clearInterval(intervalId);
    }
}, 45);

var offset = 0;
function generateDeviceNode(shuffleClipPaths){
    //return frameTemplate.cloneNode(true).querySelector('.widget-device');
    if (shuffleClipPaths){
        _.each(clipPathsById,function(cp,id){
            var newId = id + '---' + (offset++);
            cp.setAttribute('id',newId);
            _.each(clippedById[id], function(thisClipped){
                thisClipped.setAttribute('clip-path','url(#' + newId +')');
            })
        });
    }
    return document.importNode(frameTemplate.content,true).querySelector('.widget-device');
}

function setFrame(j){
    var frame=document.getElementById('frame-'+j);
    if (!frame)return;
    var deviceNode = generateDeviceNode(true);
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
    for (var j = 0; j < framesInStory; j++) {
        //apparently we are supposed to write to template first? weird...
        var t = frameHolderTemplate.content;
        t.querySelector('.frame-thumbnail').id='frame-'+j;
        t.querySelector('.frame-body').setAttribute('transform','translate(' + j*80 + ',0)');
        var holderNode = document.importNode(t,true);
        frameThumbnails.appendChild(holderNode.querySelector('.frame-thumbnail'));
    }
}