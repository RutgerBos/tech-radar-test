// The MIT License (MIT)

// Copyright (c) 2017-2024 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function radar_visualization(config) {

  config.svg_id = config.svg || "radar";
  config.width = config.width || 1450;
  config.height = config.height || 1000;
  config.colors = ("colors" in config) ? config.colors : {
      background: "#fff",
      grid: '#dddde0',
      inactive: "#ddd"
    };
  config.print_layout = ("print_layout" in config) ? config.print_layout : true;
  config.links_in_new_tabs = ("links_in_new_tabs" in config) ? config.links_in_new_tabs : true;
  config.repo_url = config.repo_url || '#';
  config.print_ring_descriptions_table = ("print_ring_descriptions_table" in config) ? config.print_ring_descriptions_table : false;
  config.title_offset = config.title_offset || { x: -675, y: -420 };
  config.footer_offset = config.footer_offset || { x: -155, y: 450 };
  config.legend_column_width = config.legend_column_width || 140
  config.legend_line_height = config.legend_line_height || 10

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var seed = 42;
  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // Compute N equal segments from config.quadrants.length.
  // radial_min / radial_max are multiples of PI, normalized to (-1, 1].
  // radial_raw_min / radial_raw_max are the un-normalized monotone values,
  // used for random point generation to avoid wrap-around issues.
  const num_segments = config.quadrants.length;
  const arc_size = 2 / num_segments; // full circle = 2.0 in PI-units

  function normalize_angle(v) {
    return v > 1 ? v - 2 : v;
  }

  const quadrants = config.quadrants.map(function(_, i) {
    var raw_min = i * arc_size;
    var raw_max = (i + 1) * arc_size;
    var mid_raw = (raw_min + raw_max) / 2;
    return {
      radial_min:     normalize_angle(raw_min),
      radial_max:     normalize_angle(raw_max),
      radial_raw_min: raw_min,  // monotone, for random()
      radial_raw_max: raw_max,
      mid_angle:      normalize_angle(mid_raw) * Math.PI
    };
  });

  if (!config.rings || config.rings.length < 1) {
    throw new Error("radar_visualization: config.rings must have at least 1 entry");
  }
  const num_rings = config.rings.length;
  const r_inner = config.inner_radius || 30;
  const r_max_default = config.max_radius || 400;

  // Build local rings array: honour explicit per-ring radius values if supplied,
  // otherwise auto-compute evenly-spaced radii up to r_max_default.
  const rings = config.rings.map(function(r, i) {
    var radius = (r.radius != null)
      ? r.radius
      : Math.round(r_inner + (r_max_default - r_inner) * (i + 1) / num_rings);
    return { radius: radius };
  });

  // Auto-compute legend offsets: place legends in two side columns (left and right
  // of the radar) so they never overlap the circle regardless of item count.
  // x_right / x_left are chosen so text at those columns is always outside the radar.
  if (!config.legend_offset) {
    var r_max = rings[rings.length - 1].radius;
    var col_width = config.legend_column_width || 140;
    var legend_pad = 20;
    var x_right = r_max + legend_pad;                  // right column anchor
    var x_left  = -(r_max + col_width + legend_pad);   // left column anchor

    // Assign each segment to left (cos < 0) or right (cos >= 0) column.
    var right_segs = [], left_segs = [];
    quadrants.forEach(function(q, i) {
      (Math.cos(q.mid_angle) >= 0 ? right_segs : left_segs).push(i);
    });

    // Within each column sort top-to-bottom (most negative sin = highest on screen).
    function sort_top_to_bottom(arr) {
      arr.sort(function(a, b) {
        return Math.sin(quadrants[a].mid_angle) - Math.sin(quadrants[b].mid_angle);
      });
    }
    sort_top_to_bottom(right_segs);
    sort_top_to_bottom(left_segs);

    // Space y anchors evenly across the radar's vertical extent.
    function assign_y(indices) {
      var n = indices.length;
      return indices.map(function(_, k) {
        return Math.round(-r_max + (2 * k + 1) / (2 * n) * 2 * r_max);
      });
    }

    config.legend_offset = new Array(num_segments);
    assign_y(right_segs).forEach(function(y, k) {
      config.legend_offset[right_segs[k]] = { x: x_right, y: y };
    });
    assign_y(left_segs).forEach(function(y, k) {
      config.legend_offset[left_segs[k]] = { x: x_left, y: y };
    });
  }

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }

  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  // Clamp angle t into [t_min, t_max], handling wrap-around (t_min > t_max).
  function clamp_angle(t, t_min, t_max) {
    if (t_min <= t_max) {
      return Math.max(t_min, Math.min(t_max, t));
    }
    // Wrap-around segment: valid range is [t_min, PI] ∪ [-PI, t_max]
    if (t >= t_min || t <= t_max) return t;
    // Clamp to nearest boundary (using circular distance)
    var d_min = Math.abs(t - t_min);
    var d_max = Math.abs(t - t_max);
    d_min = Math.min(d_min, 2 * Math.PI - d_min);
    d_max = Math.min(d_max, 2 * Math.PI - d_max);
    return d_min < d_max ? t_min : t_max;
  }

  // Check whether angle a is within [t_min, t_max], handling wrap-around.
  function angle_in_range(a, t_min, t_max) {
    if (t_min <= t_max) return a >= t_min && a <= t_max;
    return a >= t_min || a <= t_max;
  }

  function segment(quadrant, ring) {
    var t_min = quadrants[quadrant].radial_min * Math.PI;
    var t_max = quadrants[quadrant].radial_max * Math.PI;
    // Use raw (monotone) angles for random generation to avoid wrap-around issues
    var t_raw_min = quadrants[quadrant].radial_raw_min * Math.PI;
    var t_raw_max = quadrants[quadrant].radial_raw_max * Math.PI;
    var r_min = ring === 0 ? r_inner : rings[ring - 1].radius;
    var r_max = rings[ring].radius;
    var pad = 15;

    return {
      clipx: function(d) {
        var p = polar(d);
        p.t = clamp_angle(p.t, t_min, t_max);
        p.r = bounded_interval(p.r, r_min + pad, r_max - pad);
        d.x = cartesian(p).x;
        return d.x;
      },
      clipy: function(d) {
        var p = polar(d);
        p.t = clamp_angle(p.t, t_min, t_max);
        p.r = bounded_interval(p.r, r_min + pad, r_max - pad);
        d.y = cartesian(p).y;
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(t_raw_min, t_raw_max),
          r: normal_between(r_min, r_max)
        });
      }
    }
  }

  // position each entry randomly in its segment
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    var point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color = entry.active || config.print_layout ?
      config.rings[entry.ring].color : config.colors.inactive;
  }

  // partition entries according to segments
  var segmented = new Array(num_segments);
  for (let quadrant = 0; quadrant < num_segments; quadrant++) {
    segmented[quadrant] = new Array(rings.length);
    for (var ring = 0; ring < rings.length; ring++) {
      segmented[quadrant][ring] = [];
    }
  }
  for (var i=0; i<config.entries.length; i++) {
    var entry = config.entries[i];
    if (entry.ring >= num_rings) {
      console.warn("Entry '" + entry.label + "' has ring " + entry.ring + " but only " + num_rings + " rings defined; skipping.");
      continue;
    }
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  // Sort quadrants clockwise from top (angle closest to -PI/2 = upward in SVG)
  var quadrant_order = Array.from({length: num_segments}, function(_, i) { return i; });
  quadrant_order.sort(function(a, b) {
    function clockwise_from_top(t) { return ((t + Math.PI / 2) + 2 * Math.PI) % (2 * Math.PI); }
    return clockwise_from_top(quadrants[a].mid_angle) - clockwise_from_top(quadrants[b].mid_angle);
  });

  var id = 1;
  for (var qi = 0; qi < num_segments; qi++) {
    var quadrant = quadrant_order[qi];
    for (var ring = 0; ring < rings.length; ring++) {
      var entries = segmented[quadrant][ring];
      entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
      for (var i=0; i<entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  // Compute viewbox for a zoomed single segment using its actual arc bounding box.
  function viewbox(quadrant) {
    var t_min = quadrants[quadrant].radial_min * Math.PI;
    var t_max = quadrants[quadrant].radial_max * Math.PI;
    var R = rings[rings.length - 1].radius;
    var pad = 20;

    var points = [
      {x: 0, y: 0},
      {x: R * Math.cos(t_min), y: R * Math.sin(t_min)},
      {x: R * Math.cos(t_max), y: R * Math.sin(t_max)}
    ];

    // Include any axis-crossing extremes within the arc range
    var axis_angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI];
    for (var j = 0; j < axis_angles.length; j++) {
      var a = axis_angles[j];
      if (angle_in_range(a, t_min, t_max)) {
        points.push({x: R * Math.cos(a), y: R * Math.sin(a)});
      }
    }

    var xs = points.map(function(p) { return p.x; });
    var ys = points.map(function(p) { return p.y; });
    var x_min = Math.min.apply(null, xs) - pad;
    var y_min = Math.min.apply(null, ys) - pad;
    var x_max = Math.max.apply(null, xs) + pad;
    var y_max = Math.max.apply(null, ys) + pad;

    return [x_min, y_min, x_max - x_min, y_max - y_min].join(" ");
  }

  // adjust with config.scale.
  config.scale = config.scale || 1;
  var scaled_width = config.width * config.scale;
  var scaled_height = config.height * config.scale;

  var svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", scaled_width)
    .attr("height", scaled_height);

  var radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(scaled_width / 2, scaled_height / 2).concat(`scale(${config.scale})`));
  }

  var grid = radar.append("g");

  // define default font-family
  config.font_family = config.font_family || "Arial, Helvetica";

  // draw segment divider lines (one per segment boundary, from center to edge)
  var max_radius = rings[rings.length - 1].radius;
  for (var i = 0; i < num_segments; i++) {
    var angle = quadrants[i].radial_min * Math.PI;
    grid.append("line")
      .attr("x1", 0).attr("y1", 0)
      .attr("x2", max_radius * Math.cos(angle))
      .attr("y2", max_radius * Math.sin(angle))
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
  }

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  var defs = grid.append("defs");
  var filter = defs.append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
  filter.append("feFlood")
    .attr("flood-color", "rgb(0, 0, 0, 0.8)");
  filter.append("feComposite")
    .attr("in", "SourceGraphic");

  // draw rings
  for (var i = 0; i < rings.length; i++) {
    grid.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rings[i].radius)
      .style("fill", "none")
      .style("stroke", config.colors.grid)
      .style("stroke-width", 1);
    if (config.print_layout) {
      grid.append("text")
        .text(config.rings[i].name)
        .attr("y", -rings[i].radius + 62)
        .attr("text-anchor", "middle")
        .style("fill", config.rings[i].color)
        .style("opacity", 0.35)
        .style("font-family", config.font_family)
        .style("font-size", "42px")
        .style("font-weight", "bold")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  }

  function legend_transform(quadrant, ring, legendColumnWidth, index=null, previousHeight = null) {
    // Second column goes away from the radar: leftward for left-side segments, rightward otherwise.
    const col_dir = config.legend_offset[quadrant].x >= 0 ? 1 : -1;
    const col_break = Math.ceil(num_rings / 2);
    const dx = ring < col_break ? 0 : col_dir * legendColumnWidth;
    let dy = (index == null ? -16 : index * config.legend_line_height);

    if (ring % col_break === 1) {
      dy = dy + 36 + previousHeight;
    }

    return translate(
      config.legend_offset[quadrant].x + dx,
      config.legend_offset[quadrant].y + dy
    );
  }

  // draw title and legend (only in print layout)
  if (config.print_layout) {
    // title
    radar.append("a")
      .attr("href", config.repo_url)
      .attr("transform", translate(config.title_offset.x, config.title_offset.y))
      .append("text")
      .attr("class", "hover-underline")  // add class for hover effect
      .text(config.title)
      .style("font-family", config.font_family)
      .style("font-size", "30")
      .style("font-weight", "bold")

    // date
    radar
      .append("text")
      .attr("transform", translate(config.title_offset.x, config.title_offset.y + 20))
      .text(config.date || "")
      .style("font-family", config.font_family)
      .style("font-size", "14")
      .style("fill", "#999")

    // footer
    radar.append("text")
      .attr("transform", translate(config.footer_offset.x, config.footer_offset.y))
      .text("▲ moved up     ▼ moved down     ★ new     ⬤ no change")
      .attr("xml:space", "preserve")
      .style("font-family", config.font_family)
      .style("font-size", "12px");

    // legend
    const legend = radar.append("g");
    for (let quadrant = 0; quadrant < num_segments; quadrant++) {
      legend.append("text")
        .attr("transform", translate(
          config.legend_offset[quadrant].x,
          config.legend_offset[quadrant].y - 45
        ))
        .text(config.quadrants[quadrant].name)
        .style("font-family", config.font_family)
        .style("font-size", "18px")
        .style("font-weight", "bold");
      const col_break = Math.ceil(num_rings / 2);
      let previousLegendHeight = 0
      for (let ring = 0; ring < rings.length; ring++) {
        if (ring % col_break === 0) {
          previousLegendHeight = 0
        }
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring, config.legend_column_width, null, previousLegendHeight))
          .text(config.rings[ring].name)
          .style("font-family", config.font_family)
          .style("font-size", "12px")
          .style("font-weight", "bold")
          .style("fill", config.rings[ring].color);
        legend.selectAll(".legend" + quadrant + ring)
          .data(segmented[quadrant][ring])
          .enter()
            .append("a")
              .attr("href", function (d, i) {
                 return d.link ? d.link : "#"; // stay on same page if no link was provided
              })
              // Add a target if (and only if) there is a link and we want new tabs
              .attr("target", function (d, i) {
                 return (d.link && config.links_in_new_tabs) ? "_blank" : null;
              })
            .append("text")
              .attr("transform", function(d, i) { return legend_transform(quadrant, ring, config.legend_column_width, i, previousLegendHeight); })
              .attr("class", "legend" + quadrant + ring)
              .attr("id", function(d, i) { return "legendItem" + d.id; })
              .text(function(d) { return d.id + ". " + d.label; })
              .style("font-family", config.font_family)
              .style("font-size", "11px")
              .on("mouseover", function(event, d) { showBubble(d); highlightLegendItem(d); })
              .on("mouseout", function(event, d) { hideBubble(d); unhighlightLegendItem(d); })
              .call(wrap_text)
              .each(function() {
                previousLegendHeight += d3.select(this).node().getBBox().height;
              });
      }
    }
  }

  function wrap_text(text) {
    let heightForNextElement = 0;

    text.each(function() {
      const textElement = d3.select(this);
      const words = textElement.text().split(" ");
      let line = [];

      // Use '|' at the end of the string so that spaces are not trimmed during rendering.
      const number = `${textElement.text().split(".")[0]}. |`;
      const legendNumberText = textElement.append("tspan").text(number);
      const legendBar = textElement.append("tspan").text('|');
      const numberWidth = legendNumberText.node().getComputedTextLength() - legendBar.node().getComputedTextLength();

      textElement.text(null);

      let tspan = textElement
          .append("tspan")
          .attr("x", 0)
          .attr("y", heightForNextElement)
          .attr("dy", 0);

      for (let position = 0; position < words.length; position++) {
        line.push(words[position]);
        tspan.text(line.join(" "));

        // Avoid wrap for first line (position !== 1) to not end up in a situation where the long text without
        // whitespace is wrapped (causing the first line near the legend number to be blank).
        if (tspan.node().getComputedTextLength() > config.legend_column_width && position !== 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [words[position]];

          tspan = textElement.append("tspan")
              .attr("x", numberWidth)
              .attr("dy", config.legend_line_height)
              .text(words[position]);
        }
      }

      const textBoundingBox = textElement.node().getBBox();
      heightForNextElement = textBoundingBox.y + textBoundingBox.height;
    });
  }

  // layer for entries
  var rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  var bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none");
  bubble.append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .style("fill", "#333");
  bubble.append("text")
    .style("font-family", config.font_family)
    .style("font-size", "10px")
    .style("fill", "#fff");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#333");

  function showBubble(d) {
    if (d.active || config.print_layout) {
      var tooltip = d3.select("#bubble text")
        .text(d.label);
      var bbox = tooltip.node().getBBox();
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2, d.y - 16))
        .style("opacity", 0.8);
      d3.select("#bubble rect")
        .attr("x", -5)
        .attr("y", -bbox.height)
        .attr("width", bbox.width + 10)
        .attr("height", bbox.height + 4);
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 - 5, 3));
    }
  }

  function hideBubble(d) {
    var bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
  }

  function highlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.setAttribute("filter", "url(#solid)");
    legendItem.setAttribute("fill", "white");
  }

  function unhighlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.removeAttribute("filter");
    legendItem.removeAttribute("fill");
  }

  // draw blips on radar
  var blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", "blip")
        .attr("transform", function(d, i) { return legend_transform(d.quadrant, d.ring, config.legend_column_width, i); })
        .on("mouseover", function(event, d) { showBubble(d); highlightLegendItem(d); })
        .on("mouseout", function(event, d) { hideBubble(d); unhighlightLegendItem(d); });

  // configure each blip
  blips.each(function(d) {
    var blip = d3.select(this);

    // blip link
    if (d.active && Object.prototype.hasOwnProperty.call(d, "link") && d.link) {
      blip = blip.append("a")
        .attr("xlink:href", d.link);

      if (config.links_in_new_tabs) {
        blip.attr("target", "_blank");
      }
    }

    // blip shape
    if (d.moved == 1) {
      blip.append("path")
        .attr("d", "M -11,5 11,5 0,-13 z") // triangle pointing up
        .style("fill", d.color);
    } else if (d.moved == -1) {
      blip.append("path")
        .attr("d", "M -11,-5 11,-5 0,13 z") // triangle pointing down
        .style("fill", d.color);
    } else if (d.moved == 2) {
      blip.append("path")
        .attr("d", d3.symbol().type(d3.symbolStar).size(200))
        .style("fill", d.color);
    } else {
      blip.append("circle")
        .attr("r", 9)
        .attr("fill", d.color);
    }

    // blip text
    if (d.active || config.print_layout) {
      var blip_text = config.print_layout ? d.id : d.label.match(/[a-z]/i);
      blip.append("text")
        .text(blip_text)
        .attr("y", 3)
        .attr("text-anchor", "middle")
        .style("fill", "#fff")
        .style("font-family", config.font_family)
        .style("font-size", function(d) { return blip_text.length > 2 ? "8px" : "9px"; })
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  });

  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);

  function ringDescriptionsTable() {
    var table = d3.select("body").append("table")
      .attr("class", "radar-table")
      .style("border-collapse", "collapse")
      .style("position", "relative")
      .style("top", "-70px")  // Adjust this value to move the table closer vertically
      .style("margin-left", "50px")
      .style("margin-right", "50px")
      .style("font-family", config.font_family)
      .style("font-size", "13px")
      .style("text-align", "left");

    var thead = table.append("thead");
    var tbody = table.append("tbody");

    // define fixed width for each column
    var columnWidth = `${100 / config.rings.length}%`;

    // create table header row with ring names
    var headerRow = thead.append("tr")
      .style("border", "1px solid #ddd");

    headerRow.selectAll("th")
      .data(config.rings)
      .enter()
      .append("th")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("background-color", d => d.color)
      .style("color", "#fff")
      .style("width", columnWidth)
      .text(d => d.name);

    // create table body row with descriptions
    var descriptionRow = tbody.append("tr")
      .style("border", "1px solid #ddd");

    descriptionRow.selectAll("td")
      .data(config.rings)
      .enter()
      .append("td")
      .style("padding", "8px")
      .style("border", "1px solid #ddd")
      .style("width", columnWidth)
      .text(d => d.description);
  }

  if (config.print_ring_descriptions_table) {
    ringDescriptionsTable();
  }
}
