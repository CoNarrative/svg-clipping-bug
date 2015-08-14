var svgns = "http://www.w3.org/2000/svg";
var framesInStory = 10;
var numberOfUpdates = 10;
var sampleEvery = 1;
var accumulated = 0;
var samples = [];
var removeClipping = false;
["eternal", "launch", "300e6bea-cc3c-46eb-a65e-010d943f2bbb", "e2354a77-d92b-489f-8bc3-fc7ffacb1c73", "a06e8505-999d-4ce2-a117-f92e83618ee3", "4caa2135-46a0-4bd8-a3f8-145f58cee7db", "0fefc2f2-6368-45a8-9f59-c849136fa1b3", "a30130bf-e66d-467d-867f-b2129f24125a", "234467c0-755a-4c41-8d0b-2b3182fde130", "0f3f82e0-d739-4c81-afe3-7b449e0e0178"]

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

if (removeClipping) {
    _.each(clipPaths, function (c) {
        c.remove();
    });
}

document.body.innerHTML = '<svg id="frame-thumbnails" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%"></svg>'


var frameThumbnails = document.getElementById('frame-thumbnails');

buildFrameHolders();

var updateIndex = 0;
var intervalId = setInterval(function () {
    console.log ('updating ' + framesInStory + ' frames');
    //update all the frames by clearing and setting them...
    for (var frameIndex=0;frameIndex<framesInStory;frameIndex++){
        var startTime = Date.now();
        clearFrame(frameIndex);
        var endTime = Date.now();
        accumulated += endTime - startTime;
        setFrame(frameIndex);
    }
    updateIndex++;


    if (updateIndex % sampleEvery === 0) {
        console.log('update cycle', updateIndex, ': ',accumulated / sampleEvery / framesInStory, 'ms per frame');
        samples.push(accumulated / sampleEvery);
        accumulated = 0;
    }
    console.log ('FINISHED updating ' + framesInStory + ' frames');
    if (updateIndex >= numberOfUpdates) {
        console.log('DONE!');
        console.log(samples);
        clearInterval(intervalId);
    }
}, 200);

var offset = 0;
function generateDeviceNode(shuffleClipPaths){
    //return frameTemplate.cloneNode(true).querySelector('.widget-device');
    if (!removeClipping && shuffleClipPaths){
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

function setFrame(i){
    var frame=document.getElementById('frame-'+i);
    if (!frame)return;
    var deviceNode = generateDeviceNode(true);
    var contentNode = frame.querySelector('.frame-thumbnail > .frame-body > .content');
    contentNode.appendChild(deviceNode);
}
function clearFrame(i) {
    var frame=document.getElementById('frame-'+i);
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