
// TODO: Move global vars into an "app" dictionary"
// a cocktail dictionary with key = cocktail name, value = { type, ingredients }
var cocktail = {};
var graph;
var display_params = {
  disabled_link: { stroke_width: '1px', opacity: '.25' },
  enabled_link:  { stroke_width: '5px', opacity: '1' }
};

// from d3 colorbrewer: 
var colors = ['#8dd3c7','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
var color_dict = {
  "After Dinner Cocktail": colors[0],
  "Before Dinner Cocktail": colors[1],
  "All Day Cocktail": colors[2],
  "All Day Cocktail": colors[3],
  "Sparkling Cocktail": colors[4],
  "Longdrink": colors[5],
  "Hot Drink": colors[6],
  "Unspecified": colors[7],
  "After Dinner": colors[8]
}

drink_types = new Set([]);
d3.csv("cocktail.csv", function (data) {

  // go over the data row-by-row.
  data.forEach(function (d) {

    // each row will be a dictiornary with key = column name, and
    // value = corresponding value at the row index.
    
    // extract only relevant data.
    name = d["Cocktail Name"];
    ingredient = d["All Ingredients"];
    drink_type = d["Sort of drink"];
    if (drink_type == "") {
      drink_type = "Unspecified"
    }

    // add the data only if both name and ingredient are valid.
    if (name != "" && ingredient != "") {
      if (name in cocktail) {
        cocktail[name]["ingredients"].push(ingredient);
      } 
      else {
        cocktail[name] = { type: drink_type, ingredients: [ingredient] };
      }
    }

    // construct filtering dictionary.
    drink_types.add(drink_type);
  });

  // transform the data into a useful representation
  // 1 is inner, 2, is outer

  // need: inner, outer, links
  //
  // inner: 
  // links: { inner: outer: }
  var outer = d3.map();
  var inner = [];
  var links = [];
  var outerId = [0];
  for (const [key, value] of Object.entries(cocktail)) {

    i = { id: 'i' + inner.length, name: key, related_links: [], type: value["type"] };
    i.related_nodes = [i.id];
    inner.push(i);
    
    value["ingredients"].forEach(function(d1) {
      
      o = outer.get(d1);
      
      if (o == null)
      {
        o = { name: d1,	id: 'o' + outerId[0], related_links: [] };
        o.related_nodes = [o.id];
        outerId[0] = outerId[0] + 1;	
        
        outer.set(d1, o);
      }
      
      // create the links
      l = { id: 'l-' + i.id + '-' + o.id, inner: i, outer: o }
      links.push(l);
      
      // and the relationships
      i.related_nodes.push(o.id);
      i.related_links.push(l.id);
      o.related_nodes.push(i.id);
      o.related_links.push(l.id);
    });
  }

  graph = {
    inner: inner,
    outer: outer.values(),
    links: links
  }

  // sort the graph -- TODO: have multiple sort options
  outer = graph.outer;
  graph.outer = Array(outer.length);
  var i1 = 0;
  var i2 = outer.length - 1;

  for (var i = 0; i < graph.outer.length; ++i)
  {
    if (i % 2 == 1)
      graph.outer[i2--] = outer[i];
    else
      graph.outer[i1++] = outer[i];
  }

  graph.inner.sort(function (a,b) { 
    return ('' + a.type).localeCompare(b.type);
  });

  display_cocktail(cocktail);
  // display_filters();
});

function display_cocktail(cocktail) {

  // "canvas_size" represents the overall width/height of the container. The actual "circle"
  // has a canvas_size of 2/3rd of this value.
  var canvas_size = 1680;

  // these are width and height of the inner element rectangle.
  var rect_width = 120;
  var rect_height = 14;

  var il = graph.inner.length;
  var ol = graph.outer.length;

  // a mapping from inner element index => inner element y-coordinate.
  var inner_y = d3.scale.linear()
      .domain([0, il])
      .range([-(il * rect_height)/2, (il * rect_height)/2]);

  // each of the outer elements uses a radial (r, theta) coordinate system. Each outer 
  // element is a radius r (=canvas_size/3) from the center at an angle uniformly spread
  // around the circle *with gaps* in the top and bottom (for a nice "look").
  // In the SVG coordinate system,
  // -- +ve angle => clockwise rotation, and vice-versa.
  // The coodinate system is shifted later such that 0 is at the top of the chart.
  mid = (graph.outer.length/2.0)
  var outer_theta = d3.scale.linear()
      .domain([0, mid, mid, graph.outer.length])
      .range([15, 170, 190 ,355]);

  // setup the position of outer elements (in r/theta coordinate space).
  graph.outer = graph.outer.map(function(d, i) { 
      d.theta = outer_theta(i);
      d.r = canvas_size/3;
      return d;
  });

  graph.inner = graph.inner.map(function(d, i) { 
      d.x = -(rect_width / 2);
      d.y = inner_y(i);
      return d;
  });

  // Can't just use d3.svg.diagonal because one edge is in normal space, the
  // other edge is in radial space. Since we can't just ask d3 to do projection
  // of a single point, do it ourselves the same way d3 would do it.  


  function projectX(x)
  {
      return ((x - 90) / 180 * Math.PI) - (Math.PI/2);
  }

  var diagonal = d3.svg.diagonal()
      .source(function(d) { return {"x": d.outer.r * Math.cos(projectX(d.outer.theta)), 
                                    "y": -d.outer.r * Math.sin(projectX(d.outer.theta))}; })            
      .target(function(d) { return {"x": d.inner.y + rect_height/2,
                                    "y": d.outer.theta > 180 ? d.inner.x : d.inner.x + rect_width}; })
      .projection(function(d) { return [d.y, d.x]; });


  var svg = d3.select("#concept_network").append("svg")
      .attr("width", canvas_size)
      .attr("height", canvas_size)
    .append("g")
      .attr("transform", "translate(" + canvas_size / 2 + "," + canvas_size / 2 + ")");
      

  // links
  var link = svg.append('g').attr('class', 'links').selectAll(".link")
      .data(graph.links)
    .enter().append('path')
      .attr('class', 'link')
      .attr('id', function(d) { return d.id })
      .attr("d", diagonal)
      .attr('stroke', function(d, i) { 
        inner = d.inner
        if (inner.type in color_dict) {
          return color_dict[inner.type];
        }
        else {
          console.log('Warning: Unable to find match for type: ' + inner.type);
          return colors[9];
        }
      })
      .attr('stroke-width', display_params.disabled_link.stroke_width)
      .attr('opacity', display_params.disabled_link.opacity);

  // outer nodes

  var onode = svg.append('g').selectAll(".outer_node")
      .data(graph.outer)
    .enter().append("g")
      .attr("class", "outer_node")
      .attr("transform", function(d) { return "rotate(" + (d.theta - 90) + ")translate(" + d.r + ")"; })
      .on("mouseover", mouseover)
      .on("mouseout", mouseout);
    
  onode.append("circle")
      .attr('id', function(d) { return d.id })
      .attr("r", 4.5);
    
  onode.append("circle")
      .attr('r', 20)
      .attr('visibility', 'hidden');
    
  onode.append("text")
    .attr('id', function(d) { return d.id + '-txt'; })
      .attr("dy", ".31em")
      .attr("text-anchor", function(d) { return d.theta < 180 ? "start" : "end"; })
      .attr("transform", function(d) { return d.theta < 180 ? "translate(8)" : "rotate(180)translate(-8)"; })
      .text(function(d) { return d.name; });
    
  // inner nodes
    
  var inode = svg.append('g').selectAll(".inner_node")
      .data(graph.inner)
    .enter().append("g")
      .attr("class", "inner_node")
      .attr("transform", function(d, i) { return "translate(" + d.x + "," + d.y + ")"})
      .on("mouseover", mouseover)
      .on("mouseout", mouseout);
    
  inode.append('rect')
      .attr('width', rect_width)
      .attr('height', rect_height)
      .attr('id', function(d) { return d.id; })
      .attr('fill', function(d, i) { 
        if (d.type in color_dict) {
          return color_dict[d.type];
        } else {
          console.log("Warning: Unable to find color match for " + d.type);
          return colors[9];
        }
      });
    
  inode.append("text")
    .attr('id', function(d) { return d.id + '-txt'; })
      .attr('text-anchor', 'middle')
      .attr("transform", "translate(" + rect_width/2 + ", " + rect_height * .75 + ")")
      .text(function(d) { return d.name; });

  // need to specify x/y/etc

  d3.select(self.frameElement).style("height", canvas_size - 150 + "px");
}


function mouseover(d)
{

  // bring to front
  d3.selectAll('.links .link').sort(function(a, b){ return d.related_links.indexOf(a.id); });	
  link_param = display_params.enabled_link;
  
  for (var i = 0; i < d.related_nodes.length; i++) {
      d3.select('#' + d.related_nodes[i]).classed('highlight', true);
      d3.select('#' + d.related_nodes[i] + '-txt').attr("font-weight", 'bold');
  }
  
  for (var i = 0; i < d.related_links.length; i++) {
      d3.select('#' + d.related_links[i]).attr('stroke-width', link_param.stroke_width);
      d3.select('#' + d.related_links[i]).attr('opacity', link_param.opacity);
  }
}

function mouseout(d)
{   	
    for (var i = 0; i < d.related_nodes.length; i++) {
        d3.select('#' + d.related_nodes[i]).classed('highlight', false);
        d3.select('#' + d.related_nodes[i] + '-txt').attr("font-weight", 'normal');
    }
    
    link_param = display_params.disabled_link;
    for (var i = 0; i < d.related_links.length; i++) {
        d3.select('#' + d.related_links[i]).attr('stroke-width', link_param.stroke_width);
        d3.select('#' + d.related_links[i]).attr('opacity', link_param.opacity);
    }
}

function display_filters() {

  drink_type_div = d3.select("#filters").selectAll("div")
    .data(Array.from(drink_types))
    .enter().append("div")

  drink_type_div.append("input")
    .attr("type", "checkbox")
    .attr("id", function(d) { return "cb_" + d; })
    .property("checked", "true")
    .attr("onclick", "onDrinkTypeSelClick(this);");
  drink_type_div.append("label")
    .attr("for", function(d) { return "cb_" + d; })
    .text(function (d) { return d; });
}

