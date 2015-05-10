function autoscale(canvas) {
  var ctx = canvas.getContext('2d');
  var ratio = window.devicePixelRatio || 1;
  if (1 != ratio) {
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.width *= ratio;
    canvas.height *= ratio;
    ctx.scale(ratio, ratio);
  }
  return ctx;
}

var timer = null;
function debounce(fn, delay) {
  var context = this, args = arguments;
  clearTimeout(timer);
  timer = setTimeout(function() {
    fn.apply(context, args);
  }, delay);
}

function objectToArray(o) {
  return Object.keys(o).map(function (key) {
    return o[key];
  });
}

function colorOk(color) {
  return color.every(function (color) {
    return color >= 0 && color <= 255
  });
}

var colorspace = {
  'hcl': {
    dimensions: [
      ['h', 'hue', 0, 360, 0],
      ['c', 'chroma', 0, 135, 60],
      ['l', 'lightness', 0, 100, 50]],
    axis: [
      ['hlc', 'hue-lightness'],
      ['clh', 'chroma-lightness'],
      ['hcl', 'hue-chroma']]
  }
};

function Colorpicker(cb) {
  var config = {
    sq: 210,
    scale: 2,
    axis: 'hcl',
    opt: colorspace.hcl,
    x: '',
    y: '',
    z: '',
    zval: 1
  };
  this.init(config, cb);
}

Colorpicker.prototype = {
  init: function(config, cb) {
    initPosSet = false;
    function getctx(id) {
      return document.getElementById(id).getContext('2d');
    }

    function getretinactx(id) {
      return autoscale(document.getElementById(id));
    }

    function getColor(x, y) {
      var xyz = [];

      xyz[config.dx] = x;
      xyz[config.dy] = y;
      xyz[config.dz] = config.zval;

      return d3.hcl.apply(null, xyz);
    }

    function checkColor(col) {
      if (colorOk(objectToArray(col.rgb()))) {
        return col.toString();
      }
      return '#000000';
    }

    var colorctx = getctx('colorspace');

    function renderColorSpace() {
      var x, y, xv, yv, color, idx,
        xdim = config.xdim,
        ydim = config.ydim,
        sq = config.sq,
        ctx = colorctx,
        imdata = ctx.createImageData(sq, sq);

      for (x = 0; x < sq; x++) {
        for (y = 0; y < sq; y++) {

          idx = (x + y * imdata.width) * 4;

          // TODO use the xv commented out to double the colorspace and
          // allow the drag handles to move from violet to red
          // TODO Condition this. If the axis is H-L then make this value larger
          // xv = xdim[2] + ((x/sq) * 2) * (xdim[3] - xdim[2]);

          xv = xdim[2] + (x / sq) * (xdim[3] - xdim[2]);
          yv = ydim[2] + (y / sq) * (ydim[3] - ydim[2]);

          color = objectToArray(getColor(xv, yv).rgb());
          if (!colorOk(color)) {
            imdata.data[idx] = 255;
            imdata.data[idx + 1] = 0;
            imdata.data[idx + 2] = 0;
            imdata.data[idx + 3] = 0;
          } else {
            imdata.data[idx] = color[0];
            imdata.data[idx + 1] = color[1];
            imdata.data[idx + 2] = color[2];
            imdata.data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imdata, 0, 0);
      showGradient();
    }

    function updateAxis(axis) {
      config.x = axis[0];
      config.y = axis[1];
      config.z = axis[2];

      for (var i = 0; i < colorspace.hcl.dimensions.length; i++) {
        var dim = colorspace.hcl.dimensions[i];
        if (dim[0] === config.x) {
          config.dx = i;
          config.xdim = dim;
        } else if (dim[0] === config.y) {
          config.dy = i;
          config.ydim = dim;
        } else if (dim[0] === config.z) {
          config.dz = i;
          config.zdim = dim;
        }
      }

      d3.select('#slider')
        .attr('min', config.zdim[2])
        .attr('max', config.zdim[3])
        .attr('step', 1)
        .attr('value', config.zval);

      d3.select('.js-slider-title')
        .text(config.zdim[1]);

      d3.select('.js-slider-value')
        .text(config.zval);
    }

    function setView(state, reset) {
      updateAxis(state.axis);
      config.zval = config.zdim[4];
      renderColorSpace();
      resetGradient();
      showGradient();
    }

    function getXY(color) {
      // inverse operation to getColor
      var hcl = objectToArray(d3.hcl(color));
      return [hcl[config.dx], hcl[config.dy]];
    }

    var slider = d3.select('#slider');
    slider.on('mousemove', function() {
        var v = Number(this.value);
        d3.select('.js-slider-value').text(v);
        config.zval = v;
        renderColorSpace();
      });

    d3.select('.js-add')
      .on('click', function() {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        swatches = swatches + 1;
        gradient.steps = swatches;
        showGradient();
    });

    d3.select('.js-subtract')
      .on('click', function() {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        if (swatches != 1) {
          swatches = swatches - 1;
          gradient.steps = swatches;
          showGradient();
        }
    });

    function resetGradient() {
      gradient.from[0] = config.xdim[2] + (config.xdim[3] - config.xdim[2]) * (23 / 36);
      gradient.from[1] = config.ydim[2] + (config.ydim[3] - config.ydim[2]) * 0.1;
      gradient.to[0] = config.xdim[2] + (config.xdim[3] - config.xdim[2]) * (8 / 36);
      gradient.to[1] = config.ydim[2] + (config.ydim[3] - config.ydim[2]) * 0.8;
    }

    var gradctx = getretinactx('grad');

    function showGradient(from) {
      // draw line
      var colors = [], col_f, col_t, col;
      var toX = function(v, dim) {
        return Math.round((v - dim[2]) / (dim[3] - dim[2]) * config.sq * config.scale) - 0.5;
      };
      var a = gradient.handlesize;
      var b = Math.floor(gradient.handlesize * 0.65);
      var x0 = toX(gradient.from[0], config.xdim) + 10;
      var x1 = toX(gradient.to[0], config.xdim) + 10;
      var y0 = toX(gradient.from[1], config.ydim) + 10;
      var y1 = toX(gradient.to[1], config.ydim) + 10;
      var fx, fy, x, y;

      var ctx = gradctx;
      ctx.clearRect(0, 0, 600, 600);

      if (!initPosSet) {
        d3.select('.drag.from').style({
          left: (x0 - a) + 'px',
          top: (y0 - a) + 'px'
        });
        d3.select('.drag.to').style({
          left: (x1 - a) + 'px',
          top: (y1 - a) + 'px'
        });
      }

      // The line that connects the two circular
      // drag controls on the colorpicker.
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // `from` drag control on the colorpicker.
      ctx.beginPath();
      ctx.strokeStyle = '#fff';
      col_f = checkColor(getColor(gradient.from[0], gradient.from[1]));
      ctx.fillStyle = col_f;
      ctx.arc(x0, y0, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
      ctx.stroke();

      // `to` drag control on the colorpicker.
      ctx.beginPath();
      col_t = checkColor(getColor(gradient.to[0], gradient.to[1]));
      ctx.fillStyle = col_t;
      ctx.arc(x1, y1, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
      ctx.stroke();

      colors.push(col_f);

      for (var i = 1; i < gradient.steps - 1; i++) {
        fx = gradient.from[0] + (i / (gradient.steps - 1)) * (gradient.to[0] - gradient.from[0]);
        fy = gradient.from[1] + (i / (gradient.steps - 1)) * (gradient.to[1] - gradient.from[1]);
        x = toX(fx, config.xdim[2]) + 10;
        y = toX(fy, config.ydim[2]) + 10;

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        col = checkColor(getColor(fx, fy));
        colors.push(col);
        ctx.fillStyle = col;
        ctx.arc(x, y, b, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.stroke();
      }

      colors.push(col_t);
      updateSwatches(colors);

      // Update the url hash
      debounce(function() {
        location.href = '#/' + serialize();
      }, 100);
    }

    function updateSwatches(colors) {
      ['#visual-output', '#legend-output'].forEach(function(id) {
        var output = d3.select(id)
          .selectAll('div.swatch').data(colors);
        output.exit().remove();
        output.enter().append('div').attr('class', 'swatch');
        output.style('background', String);
      });

      cb(colors);
      var output = d3.select('#code-output')
        .selectAll('span.value').data(colors);

      output.exit().remove();
      output.enter().append('span').attr('class', 'value');
      output.text(String);
    }

    function unserialize(hash) {
      if (!hash) {
        // default init settings
        return {
          swatches: 6,
          axis: colorspace.hcl.axis[0],
          from: [0, 1],
          to: [1, 0.6]
        };
      }
      var parts = hash.split('/');
      var zval = Number(parts[2]);

      config.zval = zval;
      d3.select('#sl-val').select('span').html(zval);
      updateAxis(parts[0]);


      return {
        swatches: Number(parts[1]),
        axis: parts[0],
        from: getXY('#' + parts[3]),
        to: getXY('#' + parts[4])
      };
    }

    function serialize() {
      return config.x + config.y + config.z + '/' +
        gradient.steps + '/' +
        config.zval + '/' +
        getColor(gradient.from[0], gradient.from[1]).toString().substr(1) + '/' +
        getColor(gradient.to[0], gradient.to[1]).toString().substr(1);
    }

    var drag = d3.behavior.drag()
      .origin(Object)
      .on('drag', function(d) {
        initPosSet = true;

        var posX = parseInt(d3.select(this).style('left').split('px')[0], 10);
        var posY = parseInt(d3.select(this).style('top').split('px')[0], 10);

        // 440 = width of container. 30 = width of drag circle.
        posX = Math.max(0, Math.min(440 - 30, posX + d3.event.dx));
        // 440 = height of container. 30 = height of drag circle.
        posY = Math.max(0, Math.min(440 - 30, posY + d3.event.dy));

        d3.select(this).style({
          left: posX + 'px',
          top: posY + 'px'
        });

        var from = d3.select(this).classed('from');
        var x = posX + gradient.handlesize - 10;
        var y = posY + gradient.handlesize - 10;
        var xv = x / (config.sq * config.scale) * (config.xdim[3] - config.xdim[2]) + config.xdim[2];
        var yv = y / (config.sq * config.scale) * (config.ydim[3] - config.ydim[2]) + config.ydim[2];

        xv = Math.min(config.xdim[3], Math.max(config.xdim[2], xv));
        yv = Math.min(config.ydim[3], Math.max(config.ydim[2], yv));

        if (from) {
          gradient.from = [xv, yv];
          showGradient(from);
        } else {
          gradient.to = [xv, yv];
          showGradient();
        }
    });
    d3.select('.drag.to').call(drag);
    d3.select('.drag.from').call(drag);

    function axisLinks() {
      var axis_links = d3.select('.axis-select')
        .selectAll('a')
        .data(colorspace.hcl.axis);

      axis_links.exit().remove();
      axis_links.enter().append('a')
        .attr('href', '#')
        .attr('class', function(d) {
          return 'axis-option block button pad0x unround ' + d[0];
        })
        .attr('data-tooltip', function(d) {
            return d[1];
          }
        )
        .classed('active', function(d) {
          return d[0] == config.axis;
        })
        .text(function(d) {
          return d[0][0] + '–' + d[0][1];
        })
        .on('click', function(d) {
          d3.event.preventDefault();
          d3.event.stopPropagation();
          initPosSet = false;
          updateAxis(d[0]);
          resetGradient();
          renderColorSpace();
          showGradient();
          d3.selectAll('a.axis-option').classed('active', function(_) {
            return _[0] == d[0];
          });
        });
    }

    var hash = location.hash.slice(2);
    var state = unserialize(hash);
    var swatches = state.swatches;

    var gradient = {
      from: state.from,
      to: state.to, //x,y
      steps: swatches,
      handlesize: 15
    };

    config.axis = state.axis;
    setView(state);
    axisLinks();
    showGradient();
  }
};

function choropleth(counties, colors) {
  d3.json('example-data/unemployment.json', function(data) {
    var quantize = d3.scale.quantile().domain(d3.values(data)).range(d3.range(colors.length));
    d3.json('example-data/us-counties.json', function(json) {
      counties.selectAll('path').data(json.features).enter().append('svg:path').attr('style', function(d) {
          return 'fill:' + colors[quantize(data[pad(d.id)])] + ';';
        })
        .attr('d', path).append('svg:title').text(function(d) {
          return d.properties.name + ': ' + data[pad(d.id)] + '%';
        });
      d3.select('#visualization').classed('loading', false);
    });
  });
}

var client = new ZeroClipboard( document.getElementById('select') );
var selectButton = d3.selectAll('.js-select');

client.on('ready', function() {
  d3.select('.output').classed('with-select', true);
  selectButton.classed('hidden', false);
  client.on('aftercopy', function(e) {
    selectButton.text('Copied!');
    setTimeout(function() {
      selectButton.text('Copy')
        .append('span')
        .attr('class', 'sprite icon clipboard');
    }, 1000);
  });
});

var mode = d3.selectAll('.js-mode');
var vizs = d3.select('#visualization');
var pick = d3.select('#picker');
var select = d3.select('.js-select');
var colorArray = [];
select.on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
});

if (!location.hash) location.hash = '/hlc/6/1/16534C/E2E062';
new Colorpicker(function(colors) {
  colorArray = colors;
  select.attr('data-clipboard-text', colors);
});
var path = d3.geo.path()
  .projection(d3.geo.albersUsa()
    .scale(960)
    .translate([480, 265]));

var svg = vizs.append('svg:svg')
  .attr('width', 960)
  .attr('height', 500);

var counties = svg.append('svg:g').attr('id', 'counties');
var pad = d3.format('05d');

mode.on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();

  var el = d3.select(this);
  mode.classed('active', false);
  el.classed('active', true);

  if (el.attr('href').split('#')[1] === 'picker') {
    vizs.classed('hidden', true);
    pick.classed('hidden', false);
    counties.selectAll('path').remove();
  } else {
    pick.classed('hidden', true);
    vizs.classed('hidden', false).classed('loading', true);
    choropleth(counties, colorArray);
  }
});
