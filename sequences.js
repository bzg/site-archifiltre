

function plot(csv_string) {

  d3.select("#chart").selectAll("svg").remove()
  d3.select("#legend").selectAll("svg").remove()


  // Dimensions of sunburst.
  var width = 800;
  var height = 300;

  // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
  var b = {
    w: null, h: 30, s: 3, t: 3
  };

  // Mapping of step names to colors.
  var colors = {
    répertoire : "#fabf0b",
    tableur : "#52d11a",
    document : "#1a55ea",
    présentation : "#e33b14",
    autres : "#8a8c93",
    email: "#13d6f3",
    multimédia: "#9735f2"
  };

  var font_size = 10


  function colorOf(name, children) {
    
    if (children !== undefined) {
      return colors.répertoire;
    } else {
      var m = name.match(/\..*$/)

      if (m == null)
        m = [""]

      switch(m[0]){
        case ".xls": //formats Microsoft Excel
        case ".xlsx":
        case ".xlsm":
        case ".xlw": // dont les vieux
        case ".xlt":
        case ".xltx":
        case ".xltm":
        case ".csv": // format CSV
        case ".ods": //formats OOo/LO Calc
        case ".ots":
          return colors.tableur;
        case ".doc":  //formats Microsoft Word
        case ".docx":
        case ".docm":
        case ".dot":
        case ".dotx":
        case ".dotm":
        case ".odt": // formats OOo/LO Writer
        case ".ott":
        case ".txt": // formats texte standard
        case ".rtf":
          return colors.document;
        case ".ppt": // formats Microsoft PowerPoint
        case ".pptx":
        case ".pptm":
        case ".pps":
        case ".ppsx":
        case ".pot":
        case ".odp": // formats OOo/LO Impress
        case ".otp":
        case ".pdf": // On considère le PDF comme une présentation
          return colors.présentation;
        case ".eml": //formats d'email et d'archive email
        case ".msg":
        case ".pst":
          return colors.email;
        case ".jpeg": //formats d'image
        case ".jpg":
        case ".gif":
        case ".png":
        case ".bmp":
        case ".tiff":
        case ".mp3": //formats audio
        case ".wav":
        case ".wma":
        case ".avi":
        case ".wmv": //formats vidéo
        case ".mp4":
        case ".mov":
        case ".mkv":
          return colors.multimédia;
        default:
          return colors.autres;
        }

      }
    }

  

  function remakePath(d) {
    if (d.parent) {
      return remakePath(d.parent) + "/" + d.name
    } else {
      var root_folder_path = document.getElementById('root_folder_path').value
      return "file://" + escapeLastCharPath(root_folder_path)
    }
  }

  function isOnClickEnabled() {
    return document.getElementById('root_folder_path').value !== ''
  }

  function escapeLastCharPath(str) {
    if (str[str.length - 1] === '/') {
      return str.slice(0,-1)
    }
    return str
  }

  // Total size of all segments; we set this later, after loading the data.
  var totalSize = 0; 

  var vis = d3.select("#chart").append("svg:svg")
      .attr("width", width)
      .attr("height", height)
      .append("svg:g")
      .attr("id", "container");

  var partition = d3.layout.partition()
      .size([width, height])
      .value(function(d) { return d.size; });

  // Use d3.text and d3.csv.parseRows so that we do not need to have a header
  // row, and can receive the csv as an array of arrays.

  var csv = d3.csv.parseRows(csv_string);
  var json = buildHierarchy(csv);
  createVisualization(json);



  // Main function to draw and set up the visualization, once we have the data.
  function createVisualization(json) {

    // Basic setup of page elements.
    initializeBreadcrumbTrail();
    drawLegend();
    d3.select("#togglelegend").on("click", toggleLegend);

    // Bounding rect underneath the chart, to make it easier to detect
    // when the mouse leaves the parent g.
    vis.append("svg:rect")
        .attr("width", width)
        .attr("height", height)
        .style("opacity", 0);

    // For efficiency, filter nodes to keep only those large enough to see.
    var nodes = partition.nodes(json)
        .filter(function(d) {
        return (d.dx > 0.5);
        });

    var node = vis.data([json]).selectAll(".node")
        .data(nodes)
        .enter().append("rect")
        .attr("class", "node")
        .attr("x", function(d) { return d.x; })
        .attr("y", function(d) { return d.y; })
        .attr("width", function(d) { return d.dx; })
        .attr("height", function(d) { return d.dy; })
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .style("fill", function(d) { return colorOf(d.name, d.children); })
        .style("opacity", 1)
        .on("mouseover", mouseover)
        .on("click", function(d) {
          if (isOnClickEnabled()) {
            window.open(remakePath(d))
          }
        });

    // Add the mouseleave handler to the bounding rect.
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    totalSize = node.node().__data__.value;
   };

  // Fade all but the current sequence, and show it in the breadcrumb trail.
  function mouseover(d) {

    var percentage = (100 * d.value / totalSize).toPrecision(3);
    var percentageString = percentage + "%";
    if (percentage < 0.1) {
      percentageString = "< 0.1%";
    }

    var sequenceArray = getAncestors(d);
    updateBreadcrumbs(sequenceArray, percentageString);

    // Fade all the segments.
    d3.selectAll(".node")
        .style("opacity", 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    vis.selectAll(".node")
        .filter(function(node) {
                  return (sequenceArray.indexOf(node) >= 0);
                })
        .style("opacity", 1);
  }

  // Restore everything to full opacity when moving off the visualization.
  function mouseleave(d) {

    // Hide the breadcrumb trail
    d3.select("#trail")
        .style("visibility", "hidden");

    // Deactivate all segments during transition.
    d3.selectAll(".node").on("mouseover", null);

    // Transition each segment to full opacity and then reactivate it.
    d3.selectAll(".node")
        .transition()
        .duration(1000)
        .style("opacity", 1)
        .each("end", function() {
                d3.select(this).on("mouseover", mouseover);
              });
  }

  // Given a node in a partition layout, return an array of all of its ancestor
  // nodes, highest first, but excluding the root.
  function getAncestors(node) {
    var path = [];
    var current = node;
    while (current.parent) {
      path.unshift(current);
      current = current.parent;
    }
    return path;
  }

  function initializeBreadcrumbTrail() {
    // Add the svg area.
    var trail = d3.select("#sequence").append("svg:svg")
        .attr("width", width)
        .attr("height", 200)
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    trail.append("svg:text")
      .attr("id", "endlabel")
      .style("fill", "#000");
  }

  function computeBW(len) {
    return len * font_size
  }

  // Generate a string that describes the points of a breadcrumb polygon.
  function breadcrumbPoints(d, i) {
    var bw = computeBW(d.name.length)
    var points = [];
    points.push("0,0");
    points.push(bw + ",0");
    points.push(bw + b.t + "," + (b.h / 2));
    points.push(bw + "," + b.h);
    points.push("0," + b.h);
    if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
      points.push(b.t + "," + (b.h / 2));
    }
    return points.join(" ");
  }

  // Update the breadcrumb trail to show the current sequence and percentage.
  function updateBreadcrumbs(nodeArray, percentageString) {

    // Data join; key function combines name and depth (= position in sequence).
    var g = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function(d) { return d.name + d.depth; });

    // Add breadcrumb and label for entering nodes.
    var entering = g.enter().append("svg:g");

    entering.append("svg:polygon")
        .attr("points", breadcrumbPoints)
        .style("fill", function(d) { return colorOf(d.name, d.children); });

    entering.append("svg:text")
        .attr("x", function(d, i) {
          var bw = computeBW(d.name.length)
          return (bw + b.t) / 2
        })
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.name; });

    var tot_len = 0
    var line_length = 0
    var prev_y = 0
    var end_label_width = 35

    // Set position for entering and updating nodes.
    g.attr("transform", function(d, i) {
      var bw = computeBW(d.name.length)
      var thresh = width - bw - end_label_width
      var x = line_length % thresh
      var y = Math.floor((tot_len / thresh)) * (b.h + b.s)
      if (prev_y < y) {
        line_length = 0
        x = 0
      }
      tot_len += bw + b.s
      line_length += bw + b.s
      prev_y = y
      return "translate(" + x + ", " + y + ")";
    });

    // Remove exiting nodes.
    g.exit().remove();

    // Now move and update the percentage at the end.
    d3.select("#trail").select("#endlabel")
        .attr("x", line_length + end_label_width)
        // .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
        .attr("y", prev_y + b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
        .style("visibility", "");

  }

  function drawLegend() {

    // Dimensions of legend item: width, height, spacing, radius of rounded rect.
    var li = {
      w: 75, h: 30, s: 3, r: 3
    };

    var legend = d3.select("#legend").append("svg:svg")
        .attr("width", li.w)
        .attr("height", d3.keys(colors).length * (li.h + li.s));

    var g = legend.selectAll("g")
        .data(d3.entries(colors))
        .enter().append("svg:g")
        .attr("transform", function(d, i) {
                return "translate(0," + i * (li.h + li.s) + ")";
             });

    g.append("svg:rect")
        .attr("rx", li.r)
        .attr("ry", li.r)
        .attr("width", li.w)
        .attr("height", li.h)
        .style("fill", function(d) { return d.value; });

    g.append("svg:text")
        .attr("x", li.w / 2)
        .attr("y", li.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.key; });
  }

  function toggleLegend() {
    var legend = d3.select("#legend");
    if (legend.style("visibility") == "hidden") {
      legend.style("visibility", "");
    } else {
      legend.style("visibility", "hidden");
    }
  }

  // Take a 2-column CSV and transform it into a hierarchical structure suitable
  // for a partition layout. The first column is a sequence of step names, from
  // root to leaf, separated by hyphens. The second column is a count of how 
  // often that sequence occurred.
  function buildHierarchy(csv) {
    var root = {"name": "root", "children": []};
    for (var i = 0; i < csv.length; i++) {
      var sequence = csv[i][0];
      var size = +csv[i][1];
      if (isNaN(size)) { // e.g. if this is a header row
        continue;
      }
      var parts = sequence.split("-");
      var currentNode = root;
      for (var j = 0; j < parts.length; j++) {
        var children = currentNode["children"];
        var nodeName = parts[j];
        var childNode;
        if (j + 1 < parts.length) {
     // Not yet at the end of the sequence; move down the tree.
    var foundChild = false;
    for (var k = 0; k < children.length; k++) {
      if (children[k]["name"] == nodeName) {
        childNode = children[k];
        foundChild = true;
        break;
      }
    }
    // If we don't already have a child node for this branch, create it.
    if (!foundChild) {
      childNode = {"name": nodeName, "children": []};
      children.push(childNode);
    }
    currentNode = childNode;
        } else {
    // Reached the end of the sequence; create a leaf node.
    childNode = {"name": nodeName, "size": size};
    children.push(childNode);
        }
      }
    }
    return root;
  };

}