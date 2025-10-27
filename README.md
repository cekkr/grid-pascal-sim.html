# Advanced Grid Propagation Simulator

The Advanced Grid Propagation Simulator is a single-page exploration lab for lattices that branch, recombine, and optionally backpropagate corrections. Everything lives inside `simulator.html`, but the page now ships with a richer control surface, tabbed logic editors backed by CodeMirror, persistent layout settings, and upgraded analytics that make it easier to reason about Pascal-like systems and their more exotic cousins.

## Highlights
- Resizable control column with a collapsible editor stack; layout choices (width, editor height, collapsed state) persist via `localStorage`.
- Tabbed CodeMirror editors for primary/secondary propagation, effective-value composition, backpropagation, custom reunification, color, and HDR logic—each wired to live re-evaluation with inline error surfacing.
- Six curated presets (Pascal, Divergent, Backwards, Decay, Sierpinski, Sierpinski-Zeta) that illustrate different move sets, reunification strategies, and rendering palettes.
- Backpropagation loop support that iterates user-defined heuristics over parent/child pairs after the forward sweep.
- Inspector panel with lineage chips, value summaries, optional binary path enumeration popovers, and view-aware gradient statistics.
- Canvas renderer that auto-aggregates distant nodes, blends global and viewport statistics, and drives an HDR-aware color grading pipeline.

## Getting Started
1. Clone or download the repository.
2. Open `simulator.html` in a modern desktop browser. No build step is required.
3. Ensure the browser can reach the CodeMirror CDN (or host those assets locally for offline use).

## Interface Overview
- **Simulation Core** – Choose the number of generations, set the reunification strategy (`sum`, `average`, `max`, or user-defined `personalized` logic), and specify optional backpropagation steps that run after each generation.
- **Propagation Rules** – Define the move vectors as raw JSON. Two moves enable Pascal-style branches; additional vectors unlock multi-parent rendezvous or backtracking paths.
- **Logic Editors** – The tabbed editors accept JavaScript snippets that return functions. Toggling the personalized reunification strategy automatically reveals the matching editor. You can hide the entire editor stack for presentation mode; reopening restores the previous height.
- **Presets** – Buttons seed the workspace with canned move sets and logic. The Sierpinski preset demonstrates parity-driven rendering, Sierpinski-Zeta folds that lattice into a harmonic zeta(1) field with adaptive backprop filling the dark voids, Backwards introduces a negative move to revisit ancestors, and Divergent/Decay highlight gain and attenuation flows.
- **Projects** – Name the current configuration and save it to `localStorage`. Saved studies include logic snippets, gradient preferences, and layout mode. Load or delete entries directly from the sidebar.
- **Inspector & Analytics** – Clicking a node reveals coordinates, generation, parent/child links, and aggregated dimension metadata. Binary path analytics compute $\binom{n}{k}$ counts, 0/1 histograms, and sample enumerations; set `ENABLE_HOVER_ENUMERATION_POPUP` to `true` in `simulator.html` to mirror these details in hover tooltips.
- **Canvas Interaction** – Drag to pan, scroll to zoom. When you zoom out beyond an adaptive threshold the renderer clusters nearby nodes, tracking min/max values per bucket to keep the visualization legible.

## Custom Logic APIs
### Propagation Dimensions
Each dimension executes as:

```js
dimension(parentValue, parentDimensions, branchIndex, move, context)
```

Return either a number or `{ value, isActive, contributors, meta }`. Results are collected per child and reunified according to the selected strategy. The provided `context` exposes the parent key, generation index, move vector, and branch index so you can implement stateful or parity-based flows.

### Effective Value Function
Combine the dimension aggregates to determine the scalar rendered for the node:

```js
effectiveValue(dimensions, context)
```

`context.dimensionKeys` lists all registered dimensions. If your function throws or returns a non-finite number the simulator falls back to the primary dimension.

### Reunification Function
Selecting `personalized` enables a custom reducer:

```js
reunify(values, stats)
```

`stats` includes `{ count, sum, average, min, max }`. Return the scalar you want applied to the child node. Errors fall back to the raw sum to keep the simulation running.

### Backpropagation Function
When `Backpropagation Steps` is greater than zero, the simulator replays user logic:

```js
backprop(childState, parentState, context)
```

Return `{ parent, child }` payloads that describe `valueDelta`, `valueOverride`, or per-dimension adjustments. Steps execute sequentially, and cumulative updates are applied after each iteration to keep the lattice stable.

### Color and HDR Logic
Customize visualization with:

```js
color(value, stats, range, context)
hdr(input, context)
```

`context` exposes the current zoom `scale` so you can adjust palettes or intensify highlights when zoomed out. The default HDR function uses a logarithmic shoulder with gamma mixing to preserve contrast across large spans.

## Rendering & Performance Notes
- `GridSimulatorApp` persists layout preferences (`gridSimEditorHeight`, `gridSimSidebarWidth`, `gridSimEditorCollapsed`) and restores them on boot before the editors mount.
- The renderer blends global min/max values with viewport samples to compute gradient spans, ensuring zoomed-in detail matches the overall grid context.
- When `view.scale` drops below `AGGREGATION_SCALE_THRESHOLD`, nodes are bucketed into screen-space tiles and drawn as aggregated blobs, dramatically improving performance on large generation counts.
- Default color ramps interpolate between curated warm/cool palettes, but you can rewrite them entirely from the color logic editor.

## Simulation Lifecycle (Technical Overview)
- `updateConfigFromUI` validates moves, compiles user snippets with `new Function`, and stores both source strings and executable callbacks in `app.config`. Propagation dimensions are keyed (primary/secondary by default) so downstream rendering can introspect them.
- `generateGrid` performs the forward sweep: it clones parent dimensions, invokes each propagation function, accumulates child contributions, chooses a reunification result, and computes the effective value. Binary path metadata is tracked whenever only two moves are active, enabling $C(n, k)$ analytics without extra computation.
- Optional backpropagation steps iterate through stored parent/child links, calling the user-supplied function and applying queued updates via `applyAccumulatedUpdates`.
- `drawGrid` computes statistics, resolves gradient spans, evaluates the color/HDR functions per node (or per aggregate bucket), and renders the canvas layer. Selection outlines adjust to screen DPI so highlighted nodes remain visible.

## Mathematical Background
### Binomial Coincidence Counts
For a binary lattice with $n$ steps and $k$ rightward moves, the number of unique paths that merge at $(n, k)$ equals:

$$
C(n, k) = \binom{n}{k} = \frac{n!}{k!(n-k)!}
$$

This count drives the Binary Paths panel and aligns with the analysis in `studies/grid-analysis-ITA.md`.

### Enumerating Paths
The simulator stores sample enumerations of the binary strings that reach a node. Conceptually we permute a base string with $k$ ones and $n-k$ zeros to enumerate all coincident histories—mirroring the permutations described in the “discourse” section of the research notes.

### Trinomial and Higher-Order Lattices
Extending to three branches per generation maps to the trinomial coefficient:

$$
T(n, k_1, k_2, k_3) = \frac{n!}{k_1!\,k_2!\,k_3!}, \quad k_1 + k_2 + k_3 = n
$$

The Backwards preset demonstrates how additional move vectors can revisit earlier coordinates, while custom logic can emulate the trinomial pyramids detailed in the companion paper.

### Fractal Step Lattices
The notes also investigate halving diagonal steps, yielding coordinates of the form

$$
X = \sum_{i=1}^{n} s_i \cdot 2^{-(i-1)}, \qquad s_i \in \{-1, +1\},
$$

which produce Cantor-like dust with no coincidences. Implementing those moves requires extending the simulator to four diagonal vectors with diminishing magnitudes; the existing framework already supports variable-length move sets and custom reunification to explore such systems.

### Sierpinski-Zeta Preset
The Sierpinski-Zeta preset layers a truncated harmonic series over the classic parity mask so each generation samples the divergence of $\zeta(s)$ near its pole at $s = 1$. Parity-odd nodes climb along the harmonic envelope while parity-even voids receive a controlled negative pressure; a single backprop step then reconciles those voids with the target harmonic depth.

The associated color ramp maps positive lobes to turquoise spectral bands and drives negative wells toward magenta-black, making the Sierpiński "shadow" triangles visible as a programmable bridge to zeta dynamics.

## Reference Material
- `studies/grid-analysis-ITA.md` – combinatorial theory, trinomial expansions, and fractal lattice discourse.
- `studies/propagate-parentValue.md` – explains the separation between forward propagation and reunification.

## Configuration Flags
- `ENABLE_HOVER_ENUMERATION_POPUP`: toggled in `simulator.html` to mirror inspector enumerations as hover tooltips on the canvas and lineage chips.

## Extending the Project
- Mirror or tweak existing presets to package new lesson plans or research scenarios.
- Host the CodeMirror assets locally for offline workshops.
- Because everything is in `simulator.html`, it is straightforward to bolt on export routines, additional analytics panels, or automated sweeps that iterate over logic presets.
