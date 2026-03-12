# Motivation

At [Zalando](http://zalando.de), we maintain a [public Tech
Radar](http://zalando.github.io/tech-radar/) to help our engineering teams
align on technology choices. It is based on the [pioneering work
by ThoughtWorks](https://www.thoughtworks.com/radar).

This repository contains the code to generate the visualization:
[`radar.js`](/docs/radar.js) (based on [d3.js v7](https://d3js.org)).
Feel free to use and adapt it for your own purposes.

> [!NOTE]
> Since v0.12, we're using d3.js v7. See [related PR](https://github.com/zalando/tech-radar/pull/197/files)
> if you need to apply changes in your fork.

## Usage

1. include `d3.js` and `radar.js`:

```html
<script src="https://d3js.org/d3.v7.min.js"></script>
<script src="https://zalando.github.io/tech-radar/release/radar-0.12.js"></script>
```

2. insert an empty `svg` tag:

```html
<svg id="radar"></svg>
```

3. configure the radar visualization:

```js
radar_visualization({
  repo_url: "https://github.com/zalando/tech-radar",
  svg_id: "radar",
  width: 1450,
  height: 1000,
  scale: 1.0,
  colors: {
    background: "#fff",
    grid: "#bbb",
    inactive: "#ddd"
  },
  // Some font families might lead to font size issues
  // Arial, Helvetica, or Source Sans Pro seem to work well though
  font_family: "Arial, Helvetica",
  title: "My Radar",
  quadrants: [
    { name: "Bottom Right" },
    { name: "Bottom Left" },
    { name: "Top Left" },
    { name: "Top Right" }
  ],
  rings: [
    { name: "INNER",  color: "#5ba300" },
    { name: "SECOND", color: "#009eb0" },
    { name: "THIRD",  color: "#c7ba00" },
    { name: "OUTER",  color: "#e09b96" }
  ],
  print_layout: true,
  links_in_new_tabs: true,
  entries: [
   {
      label: "Some Entry",
      quadrant: 3,          // 0-based index into quadrants array (clockwise from bottom right)
      ring: 2,              // 0-based index into rings array (starting from inside)
      moved: -1,            // -1 = moved out (triangle pointing down)
                            //  0 = not moved (circle)
                            //  1 = moved in  (triangle pointing up)
                            //  2 = new       (star)
      remarks: "Optional free-text note shown in the hover tooltip."
   },
    // ...
  ]
});
```

Entries are positioned automatically so that they don't overlap. The "scale" parameter can help
in adjusting the size of the radar.

As a working example, you can check out `docs/index.html` &mdash; the source of our [public Tech
Radar](http://zalando.github.io/tech-radar/).

## Arbitrary segment and ring counts

The radar supports any number of **segments** (quadrants) and **rings** — not just the classic 4×4 layout.

### Changing the number of segments

Add or remove entries in the `quadrants` array. Segments are distributed evenly around the circle. Legend tables are placed left and right of the radar automatically.

```js
// 3-segment radar
quadrants: [
  { name: "Languages" },
  { name: "Infrastructure" },
  { name: "Data" },
]

// 5-segment radar
quadrants: [
  { name: "Languages" },
  { name: "Cloud Platform" },
  { name: "Platform & Ops" },
  { name: "Datastores" },
  { name: "Data Engineering" },
]
```

Each entry's `quadrant` field is a 0-based index into this array. Entries referencing a quadrant index that doesn't exist are ignored.

### Changing the number of rings

Add or remove entries in the `rings` array. Ring radii are auto-computed to fill the radar evenly if no `radius` field is provided.

```js
// 3 rings — auto-spaced
rings: [
  { name: "ADOPT",  color: "#5ba300" },
  { name: "ASSESS", color: "#c7ba00" },
  { name: "HOLD",   color: "#e09b96" }
]

// 5 rings — explicit radii
rings: [
  { name: "ADOPT",    color: "#5ba300", radius: 80  },
  { name: "TRIAL",    color: "#009eb0", radius: 160 },
  { name: "ASSESS",   color: "#c7ba00", radius: 240 },
  { name: "HOLD",     color: "#e09b96", radius: 320 },
  { name: "OBSOLETE", color: "#aaaaaa", radius: 400 }
]
```

Each entry's `ring` field is a 0-based index into this array. Entries with a `ring` value beyond the defined rings are silently skipped — useful for showing a subset of rings without changing the data file.

Two optional top-level parameters control auto-computed radii:

| Parameter | Default | Description |
|---|---|---|
| `inner_radius` | `30` | Radius of the innermost blank circle |
| `max_radius` | `400` | Outer radius of the last ring |

### Remarks / tooltip annotations

Each entry can carry an optional `remarks` field. Its content is shown in the hover tooltip below the entry label, word-wrapped and rendered in italic.

```json
{
  "label": "Go",
  "quadrant": 0,
  "ring": 0,
  "moved": 0,
  "remarks": "Primary language for backend services. Strong concurrency model and fast compile times."
}
```

### Example pages

`docs/` contains example pages for various combinations:

| | 3 rings | 4 rings | 5 rings |
|---|---|---|---|
| **3 segments** | [index-3seg-3rings.html](docs/index-3seg-3rings.html) | [index-3.html](docs/index-3.html) | [index-3seg-5rings.html](docs/index-3seg-5rings.html) |
| **4 segments** | [index-3rings.html](docs/index-3rings.html) | [index.html](docs/index.html) *(default)* | [index-5rings.html](docs/index-5rings.html) |
| **5 segments** | [index-5seg-3rings.html](docs/index-5seg-3rings.html) | [index-5.html](docs/index-5.html) | [index-5seg-5rings.html](docs/index-5seg-5rings.html) |

## Deployment

Tech Radar is a static page, so it can be deployed using any hosting provider of your choice offering static page hosting.

## Local Development

1. install dependencies with yarn (or npm):

```
yarn 
```

2. start local dev server:

```
yarn start
```

3. your default browser should automatically open and show the url
 
```
http://localhost:3000/
```

## License

```
The MIT License (MIT)

Copyright (c) 2017-2025 Zalando SE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
