var svgNs = 'http://www.w3.org/2000/svg';

var numberOfDrawings = 20;
var numberOfClippedShapesInEach = 100;
var numberOfUpdates = 5;
var sampleEvery = 1;
var accumulated = 0;
var samples = [];

var svgNode = document.querySelector('g.drawings');

//BEGIN TESTING
var updateIndex = 0;
var intervalId = setInterval(function () {
    console.log('\n');
    console.log('updating ' + numberOfDrawings + ' drawings');
    //update all the frames by clearing and setting them...
    for (var frameIndex = 0; frameIndex < numberOfDrawings; frameIndex++) {
        var startTime = Date.now();
        console.log('Clearing', frameIndex);
        removeDrawing(frameIndex);
        var endTime = Date.now();
        accumulated += endTime - startTime;
        addDrawing(frameIndex);
    }
    updateIndex++;
    if (updateIndex % sampleEvery === 0) {
        console.log('update cycle', updateIndex, ': ', accumulated / sampleEvery / numberOfDrawings, 'ms per frame');
        samples.push(accumulated / sampleEvery);
        accumulated = 0;
    }
    console.log('FINISHED updating ' + numberOfDrawings + ' frames');
    if (updateIndex >= numberOfUpdates) {
        console.log('DONE!');
        console.log(samples);
        clearInterval(intervalId);
    }
}, 2000);

function removeDrawing(id) {
    var drawing = document.getElementById('drawing-' + id);
    if (drawing) drawing.remove();
}

function addDrawing(id) {
    var drawing = generateDrawing();
    drawing.setAttribute('id', 'drawing-' + id);
    svgNode.appendChild(drawing);
}

function generateDrawing(id) {
    var drawing = document.createElementNS(svgNs,'g');
    for (var i=0;i<numberOfClippedShapesInEach;i++){
        var clippedShape = generateClippedPair();
        var x = Math.floor(Math.random()*500);
        var y = Math.floor(Math.random()*500);
        clippedShape.setAttribute('transform','translate('+x+','+y+')');
        drawing.appendChild(clippedShape);

    }
    return drawing;
}


var clipPathIndex = 0;
function generateClippedPair() {

    /* Make a group with a circle that is supposed to be clipped */
    var circle = document.createElementNS(svgNs, 'circle');
    var cpId = 'clip-path-' + clipPathIndex++;
    circle.setAttribute('cx', 50);
    circle.setAttribute('cy', 90);
    circle.setAttribute('r', 40);

    var clippedGroup = document.createElementNS(svgNs, 'g');
    clippedGroup.setAttribute('clip-path', 'url(#' + cpId + ')');
    clippedGroup.appendChild(circle);

    /* Make a clipPath with a rectangle shape */

    var clipBox = document.createElementNS(svgNs, 'rect');
    clipBox.setAttribute('id', cpId);
    clipBox.setAttribute('width', 100);
    clipBox.setAttribute('height', 100);
    var clipPath = document.createElementNS(svgNs, 'clipPath');
    clipPath.appendChild(clipBox);

    var clippedPair = document.createElementNS(svgNs, 'g');
    clippedPair.appendChild(clipPath);
    clippedPair.appendChild(clippedGroup);
    return clippedPair;


}
