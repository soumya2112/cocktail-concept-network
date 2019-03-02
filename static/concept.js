
// TODO: Move global vars into an "app" dictionary"
// a cocktail dictionary with key = cocktail name, value = { type, ingredients }
var cocktail = {};
var graph;
var display_params = {
  disabled_link: { stroke_width: '1px', opacity: '.25' },
  enabled_link:  { stroke_width: '5px', opacity: '1' }
};

// from d3 colorbrewer: 
// var colors = ['#8dd3c7','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
var colors = ['#8dd3c7','#bebada','#fb8072','#dd1c77','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
// var colors = ['#bdbdbd','#3182bd','#3994c7','#dd1c77','#3182bd','#e34a33','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f'];
var color_dict = {
  "After Dinner Cocktail": colors[0],
  "Before Dinner Cocktail": colors[1],
  "All Day Cocktail": colors[2],
  "Sparkling Cocktail": colors[3],
  "Longdrink": colors[4],
  "Hot Drink": colors[5],
  "After Dinner": colors[6]
};

d3.csv("static/cocktail.csv", function (data) {

  // go over the data row-by-row.
  data.forEach(function (d) {

    // each row will be a dictionary with key = column name, and
    // value = corresponding value at the row index.
    // For example:
    // d = { 'Cocktail Name': 'Margherita', 'All Ingredients' : 'Tequila', ... }
    
    // extract only relevant data.
    name = d["Cocktail Name"];
    ingredient = d["All Ingredients"];
    drink_type = d["Sort of drink"];
    if (drink_type == "") {
      drink_type = "Unspecified"
    }

    // add the data only if both name and ingredient are valid.
    if (name != "" && ingredient != "") {
      // - if encountering the cocktail name for the first time, initialize it as an 
      //   object with key = cocktail name and value = a dictionary containing the 
      //   "drink type" and an array of ingredients.
      // - if encoutering the same cocktail name in subsequent iterations, simply
      //   append the new ingredient to the ingredient list.
      if (name in cocktail) {
        cocktail[name]["ingredients"].push(ingredient);
      } 
      else {
        cocktail[name] = { type: drink_type, ingredients: [ingredient] };
      }
    }
  });

  /*
    Transform the cocktail data into a "network" representation containing the 
    following:

    - An array of "inner" nodes which represent the cocktail name and appear in the
      center of the graph as rectangles. It has an array of related "links" and 
      an array of related "outer" nodes.
    - An array of "outer" nodes which represent ingredients, and appear in the outer
      circle of the graph. It has an array of related "links" and an array of related
      "inner" nodes.
    - An array of "links" each reprensenting a relationship between an inner node to 
      an outer node.
   */
  var outer = d3.map(); // outer needs a map because ingredients may be repeated.
  var inner = [];
  var links = [];
  var outerId = [0];

  // iterate over the cocktail object keys and values ...
  for (const [key, value] of Object.entries(cocktail)) {

    // create an inner node ...
    i = { 
      id: 'i' + inner.length,  // unique ID.
      name: key,               // cocktail name (displayed in the rectangle).
      related_links: [],       // related links (inner <-> outer).
      type: value["type"]      // drink type (used to determine color).
    };
    // for each inner node add itself as a related node.
    i.related_nodes = [i.id];
    // add this inner node to the "inner" list.
    inner.push(i);
    
    // iterate over all the ingredients. 
    // -- ingredients need special handling because they can be repeated across 
    //    multiple cocktail names.
    value["ingredients"].forEach(function(d1) {
      
      // if this ingredient already exists in the "outer" node map, then get it
      // and use it.
      o = outer.get(d1);
      if (o == null) {
        // if we never encountered this ingredient before, we need to initialize it.
        o = { 
          name: d1,	              // ingredient name (will be displayed)
          id: 'o' + outerId[0],   // unique ID ("o" + outer node index).
          related_links: []       // a list of related links.
        };
        // for each outer node, add itself as a related node.
        o.related_nodes = [o.id];
        // keep track of the number of outer nodes (so we can use it as unique ID).
        outerId[0] = outerId[0] + 1;	
        
        // add it to the outer node list.
        outer.set(d1, o);
      }
      
      // create the links
      l = { 
        id: 'l-' + i.id + '-' + o.id,  // unique ID "i-" + i's id + "-" o's id.
        inner: i,                      // related inner node.
        outer: o                       // related outer node.
      };
      links.push(l);
      
      // add the relationships between all inner and outer nodes.
      i.related_nodes.push(o.id);
      i.related_links.push(l.id);
      o.related_nodes.push(i.id);
      o.related_links.push(l.id);
    });
  }

  // create the graph.
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

  d3.select(self.frameElement).style("height", canvas_size - 150 + "px");

  legend_rows = d3.select('#legend_table').
    append('tbody').
    selectAll('tr').
    data(d3.entries(color_dict)).enter().
    append('tr')

  legend_rows.selectAll('td')
    .data((d) => { return [d.value, d.key]; })
    .enter()
    .append('td')
    .attr('bgcolor', (d, i) => { if (i === 0) return d; else return null; })
    .attr('width', (d, i) => { if (i === 0) return "20px"; else return null; })
    .text((d, i) => { if (i === 1) return d; else return ""; });

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

