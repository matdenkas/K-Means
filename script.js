
/*
TODOs
TODO::Add finish button
TODO::Add metrics
TODO::Work on page responsiveness (either worker.js or gpu.js)
TODO::CCO code
*/

$(document).ready(function () {
  const canvas = $('#canvas')[0];
  const ctx = canvas.getContext('2d');
  const incrementor = { //obj that keeps track of how many steps we have done
    incremnet: function() {
      this.val += 1;
      $('#IterationsText').text('Iterations Run: ' + this.val);
    },
    reset: function() {
      this.val = 0;
      $('#IterationsText').text('Iterations Run: ' + this.val);
    },
    val: 0,
  }
  var globalImg = {};
  
  $("#imageInput").change(function() {
    loadImage(this);
  });

  $('#step').click(function() {
    distance = kMeanDriver();
    $('#CentroidDeltaText').text('Last Centroid Delta: ' + distance);
    incrementor.incremnet();
  });

  $('#runThrough').click(function() {
    let distance = 100;//intialization value > 0.5
    let itterations = 0;
    while(distance > 0.5 && itterations < 100) {
      distance = kMeanStep();
      $('#CentroidDeltaText').text('Last Centroid Delta: ' + distance);
      incrementor.incremnet();
    }
    kMeanDriver();
  });

  $('#centAmntSlider').change(function() {
    $('#CentroidText').text($('#centAmntSlider').val() + ' centroids'); //update text
    clearOutputCanvases();
    try {
      init();
    }
    catch(TypeError){
      console.warn("No image present, won't init");
    }
  });

  GlobalImage = undefined;
  function loadImage(e){
    if(e.files && e.files[0]) {
      var reader = new FileReader();
      reader.onload = function(event) {
        var img = new Image();
        img.onload = function(){
          GlobalImage = img;
          init();
        }
        img.src = event.target.result;

      }
      reader.readAsDataURL(e.files[0]);
    }   
  }

  function init(img) {
    incrementor.reset(); //clear past iterations
    $('#CentroidDeltaText').text('Last Centroid Delta: N/A');

    img = GlobalImage;
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img,0,0);
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    len = (img.width * img.height * 4);
    parseImageChannels(imageData, len, 4);

    var centroidAmnt = $('#centAmntSlider').val();
    initCentroids(centroidAmnt);
    populateSegmantationCanvases();
    parseCentroidData();
    plot();
  }

  let GlobalPixelData = {};
  function parseImageChannels(binaryData, len) {

    let parsedData = { 
      r: new Uint8Array(len/4),  //red channel
      g: new Uint8Array(len/4),  //blue channel
      b: new Uint8Array(len/4),  //green channel
      centroidIndex: new Array(len/4),
      size: len/4, //size of channels
      };

    for (var i = 0; i < len; i += 4) {
      parsedData.r[i/4] = binaryData.data[i];
      parsedData.g[i/4] = binaryData.data[i + 1];
      parsedData.b[i/4] = binaryData.data[i + 2];
    }
    GlobalPixelData = parsedData;
  };


  var createColorMap = function(pixData) {
    var size = pixData.size;
    let arr = new Array(size);
    for(var i = 0; i < size; i++) {
      arr[i] = 'rgba(' + pixData.r[i] + ', ' + pixData.g[i] + ', ' + pixData.b[i] + ', 1)';
    }
    return arr;
  }

  function plot(){
    pixData = prepPixelDataForPlot(GlobalPixelData);
    colorArr = createColorMap(pixData);

    var trace1 = {
      x: pixData.r, y: pixData.g, z: pixData.b,
      mode: 'markers',
      marker: {
        size: 5,
        color: colorArr,
        opacity: 0.1,
        },
      type: 'scatter3d'
    };

    var trace2 = {
      x: GlobalCentroidParsed.x, y: GlobalCentroidParsed.y, z: GlobalCentroidParsed.z,
      mode: 'markers',
      marker: {
        size: 10,
        color: 'rgba(0, 0, 0, 1)',
        opacity: 1.0,
        },
      type: 'scatter3d'
    };

    var data = [trace1, trace2];
    var layout = {
      title: {
        text: "K-Means Graph",
        xanchor: 'center',
      },
      scene: {
        xaxis:{title: 'R'},
        yaxis:{title: 'G'},
        zaxis:{title: 'B'},
      },

      plot_bgcolor: '#d3d3d3',
      paper_bgcolor: '#d3d3d3',
      width: 600,
      margin: {
        l: 0,
        r: 0,
        b: 0,
        t: 40
      },
    };
    Plotly.newPlot('graph', data, layout);
  }


  function kMeanDriver(){
    distance = kMeanStep();
    parseCentroidData();
    plot();
    populateSegmantationCanvases();
    return distance;
  }


  //initializes centorids by a certain amount
  let GlobalCentroidData = [];
  function initCentroids(centriodAmnt){
    let centroids = new Array(centriodAmnt);
    for(var i = 0; i < centriodAmnt; i++){
      centroids[i] = {
        //location in 3d space of the centroid
        loc: {x: getRandomInt(255), y: getRandomInt(255), z: getRandomInt(255)}, 
        family: [], //centroids family of pixels
        }
    }

    //iterate over every pixel
    for(var i = 0; i < GlobalPixelData.size; i++){
      let arr = []; 
      for(var j = 0; j < centroids.length; j++){
        //find the dist from this pixel to each centroid
        pixLoc = {x: GlobalPixelData.r[i], y: GlobalPixelData.g[i], z: GlobalPixelData.b[i],};
        arr.push(dist(centroids[j].loc, pixLoc)); //save that in an array
      }
      //find whichever centroid that pixel is closet to and save it to that centroids family
      m = minIndex(arr);
      centroids[m].family.push(i);
      GlobalPixelData.centroidIndex[i] = m;
    }
    GlobalCentroidData = centroids;
  }

  let GlobalCentroidParsed = {};
  var parseCentroidData = function(){
    var centroids = GlobalCentroidData;
    var len = centroids.length;
    arrX = new Array(len);
    arrY = new Array(len);
    arrZ = new Array(len);
    for(var i = 0; i < len; i++){
      arrX.push(centroids[i].loc.x);
      arrY.push(centroids[i].loc.y);
      arrZ.push(centroids[i].loc.z);
    }
    GlobalCentroidParsed = {x: arrX, y: arrY, z: arrZ};
  }

  
  //finds the avg locaton from a centroids falimy
  function famAvg(family){
    let x = 0;
    let y = 0;
    let z = 0;
    let len = family.length;
    for(var i = 0; i < len; i++){ //itterate through the fam and sum the x's y's and z's
      x += GlobalPixelData.r[family[i]];
      y += GlobalPixelData.g[family[i]];
      z += GlobalPixelData.b[family[i]];
    }

    return {x: x/len, y: y/len, z: z/len} //return their avg
  }

  function kMeanStep(){
    centroids = GlobalCentroidData;
    //iterate over every pixel
    for(var i = 0; i < GlobalPixelData.size; i++){
      let arr = []; 
      for(var j = 0; j < centroids.length; j++){
        //find the dist from this pixel to each centroid
        pixLoc = {x: GlobalPixelData.r[i], y: GlobalPixelData.g[i], z: GlobalPixelData.b[i],};
        arr.push(dist(centroids[j].loc, pixLoc)); //save that in an array
      }
      //find whichever centroid that pixel is closet to and save it to that centroids family
      m = minIndex(arr);
      centroids[m].family.push(i);
      GlobalPixelData.centroidIndex[i] = m;
    }
    
    //for each centroid calculate its new location by the avg of its family
    var arr = [];
    for(var i = 0; i < centroids.length; i++){
      oldLoc = centroids[i].loc;
      centroids[i].loc = famAvg(centroids[i].family, GlobalPixelData);
      arr.push(dist(oldLoc, centroids[i].loc));
    }

    GlobalCentroidData = centroids;
    return arr[maxIndex(arr)];
  }




  function populateSegmantationCanvases() {
    
    centroidAmnt = GlobalCentroidData.length;

    //poll all canvases
    outputCanvasArray = [];
    for(var i = 0; i < centroidAmnt; i++){
      outCanvas = $('#outputCanvas' + i)[0];
      out_ctx = outCanvas.getContext('2d');
      outCanvas.width = canvas.width;
      outCanvas.height = canvas.height;
      out_ctx.clearRect(0, 0, canvas.width, canvas.height);
      out_imgData = out_ctx.createImageData(canvas.width, canvas.height);

      obj = {
        canvas: outCanvas,
        ctx: out_ctx,
        imgData: out_imgData,
      }
      outputCanvasArray.push(obj);
    }

    //write data to image buffers
    var len = canvas.width * canvas.height * 4
    for(var i = 0; i < len; i += 4){

      //index the canvas by centroid it belongs to
      oc = outputCanvasArray[GlobalPixelData.centroidIndex[i/4]]; 

      oc.imgData.data[i + 0] = GlobalPixelData.r[i/4];
      oc.imgData.data[i + 1] = GlobalPixelData.g[i/4];
      oc.imgData.data[i + 2] = GlobalPixelData.b[i/4];
      oc.imgData.data[i + 3] = 255;
    } 

    //write buffers to canvas
    for(var i = 0; i < centroidAmnt; i++){
      oc = outputCanvasArray[i];
      oc.ctx.putImageData(oc.imgData, 0 , 0);
    }
  }
});




//HELPER FUNCTIONS-------------------------------------------------

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

//finds the dist between two points in 3d space
function dist(one, two) {
  return Math.sqrt(Math.pow((one.x - two.x), 2) + Math.pow((one.y - two.y), 2) + Math.pow((one.z - two.z), 2));
}

//finds the min value's index in an array
function minIndex(array){
  let smallest = array[0];
  let smallestIndex = 0;
  for(var i = 0; i < array.length; i++){
    if(array[i] < smallest){
      smallest = array[i];
      smallestIndex = i;
    }
  }
  return smallestIndex;
}

function maxIndex(array){
  let largest = array[0];
  let largestIndex = 0;
  for(var i = 0; i < array.length; i++){
    if(array[i] > largest){
      largest = array[i];
      largestIndex = i;
    }
  }
  return largestIndex;
}

function prepPixelDataForPlot(pixelData) {
  s = pixelData.size;
  if(s > 100000) {
    jumpsize = Math.floor(s / 100000);
    let newPixData = { 
      r: new Uint8Array(Math.ceil(s/jumpsize)),  //red channel
      g: new Uint8Array(Math.ceil(s/jumpsize)),  //blue channel
      b: new Uint8Array(Math.ceil(s/jumpsize)),  //green channel
      size: (Math.ceil(s/jumpsize)), //size of channels
    };


    for(var i = 0; i < s; i += jumpsize){
      newPixData.r[i/jumpsize] = pixelData.r[i];
      newPixData.g[i/jumpsize] = pixelData.g[i];
      newPixData.b[i/jumpsize] = pixelData.b[i];

    }
    return newPixData;
  }
  return pixelData;
}

function clearOutputCanvases() {
  for(var i = 0; i < 10; i++){
    outCanvas = $('#outputCanvas' + i)[0];
    out_ctx = outCanvas.getContext('2d');
    out_ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

