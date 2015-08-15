var pulseDelay=500;
var numberOfDrawings = 20;
var numberOfClippedShapesInEach = 100;
var numberOfUpdates = 15;
var sampleEvery = 1;
var inDivs = true;

var svgNs = 'http://www.w3.org/2000/svg';
var svgNode = document.querySelector('g.drawings');
var accumulated = 0;
var samples = [];
var addNewDrawing = inDivs?addDrawingAsDiv:addDrawing;

//BEGIN TESTING
var updateIndex = 0;
var intervalId = setInterval(function () {
    console.log('\n');
    console.log('Cycle',updateIndex,'- updating ' + numberOfDrawings + ' drawings');
    //update all the frames by clearing and setting them...
    for (var frameIndex = 0; frameIndex < numberOfDrawings; frameIndex++) {
        var startTime = Date.now();
        console.log('Clearing', frameIndex);
        removeDrawing(frameIndex);
        var endTime = Date.now();
        accumulated += endTime - startTime;
        addNewDrawing(frameIndex);
    }
    updateIndex++;
    if (updateIndex % sampleEvery === 0) {
        console.log('update cycle', updateIndex, ': ', accumulated / sampleEvery / numberOfDrawings, 'ms per drawing');
        samples.push(accumulated / sampleEvery);
        accumulated = 0;
    }
    console.log('FINISHED updating ' + numberOfDrawings + ' drawings');
    if (updateIndex >= numberOfUpdates) {
        console.log('DONE!');
        console.log(samples);
        clearInterval(intervalId);
    }
}, pulseDelay);

function removeDrawing(id) {
    var drawing = document.getElementById('drawing-' + id);
    if (drawing) drawing.remove();
}

function addDrawing(idx) {
    var drawing = generateDrawing();
    drawing.setAttribute('id', 'drawing-' + idx);
    var dim = 120;
    var x = dim * (idx % 8);
    var y = dim * Math.floor(idx/8);
    drawing.setAttribute('transform','translate('+x+','+y+') scale(0.2) ');
    svgNode.appendChild(drawing);
}

var drawingsInDivs = document.querySelector('.drawings-in-divs');
function addDrawingAsDiv(idx){
    var drawing = generateDrawing();
    drawing.setAttribute('transform','scale(0.18)');

    var holder = document.createElement('div');
    holder.setAttribute('id', 'drawing-' + idx);
    var dim = 120;
    var x = dim * (idx % 8);
    var y = dim * Math.floor(idx/8);
    holder.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" version="1.1" style="height:100%; width:100%; fill:none; stroke:black;">';
    holder.className='drawing-holder';
    holder.style.left=x;
    holder.style.top=y;
    holder.querySelector('svg').appendChild(drawing);
    drawingsInDivs.appendChild(holder);
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
    clipBox.setAttribute('width', 100);
    clipBox.setAttribute('height', 100);
    var clipPath = document.createElementNS(svgNs, 'clipPath');
    clipPath.setAttribute('id', cpId);
    clipPath.appendChild(clipBox);

    var clippedPair = document.createElementNS(svgNs, 'g');
    clippedPair.appendChild(clipPath);
    clippedPair.appendChild(clippedGroup);
    return clippedPair;


}
