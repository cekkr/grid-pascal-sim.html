# Advanced Grid Propagation Simulator

![](https://github.com/cekkr/grid-pascal-sim.html/blob/main/assets/Sierpinski-Zeta.gif?raw=true)

The Advanced Grid Propagation Simulator is a single-page exploration lab for lattices that branch, recombine, and optionally backpropagate corrections. Everything lives inside `simulator.html` (+`grid-compute-worker.js`), but the page now ships with a richer control surface, tabbed logic editors backed by CodeMirror, persistent layout settings, and upgraded analytics that make it easier to reason about Pascal-like systems and their more exotic cousins.

## Highlights
- Resizable control column with a collapsible editor stack; layout choices (width, editor height, collapsed state) persist via `localStorage`.
- Tabbed CodeMirror editors for primary/secondary propagation, effective-value composition, backpropagation, the new backprop fill helper, custom reunification, color, HDR logic, and the spatial projection/distortion duo - each wired to live re-evaluation with inline error surfacing.
- Six curated presets (Pascal, Divergent, Backwards, Decay, Sierpinski, Sierpinski-Zeta) that illustrate different move sets, reunification strategies, and rendering palettes; Sierpinski now ships with a reverse-fill backprop pass that paints voids in magenta (step 1) and violet accents (higher steps).
- Backpropagation loop support that iterates user-defined heuristics over parent/child pairs after the forward sweep.
- Inspector panel with lineage chips, value summaries, optional binary path enumeration popovers, and view-aware gradient statistics.
- Canvas renderer that auto-aggregates distant nodes, blends global and viewport statistics, and drives an HDR-aware color grading pipeline.

## Getting Started
1. Clone or download the repository.
2. Open `simulator.html` in a modern desktop browser. No build step is required.
3. Ensure the browser can reach the CodeMirror CDN (or host those assets locally for offline use).

## Interface Overview
- **Simulation Core** - Choose the number of generations, set the reunification strategy (`sum`, `average`, `max`, or user-defined `personalized` logic), and specify optional backpropagation steps that run after each generation.
- **Propagation Rules** - Define the move vectors as raw JSON. Two moves enable Pascal-style branches; additional vectors unlock multi-parent rendezvous or backtracking paths.
- **Projection Modes** - Switch between grid (planar), isometric, or custom JS layouts via the sidebar dropdown. Choosing Custom JS enables the spatial editors, and the selection is saved with each project.
- **Logic Editors** - The tabbed editors accept JavaScript snippets that return functions. Beyond the propagation/effective/backprop/backprop-fill/color stacks, a Spatial Mapping group now exposes Projection and Space Distortion panes so you can script Cartesian layouts and per-edge warps. Toggling the personalized reunification strategy automatically reveals the matching editor. You can hide the entire editor stack for presentation mode; reopening restores the previous height.
- **Presets** - Buttons seed the workspace with canned move sets and logic. The refreshed Sierpinski preset still illustrates parity-driven rendering but now adds a reverse-fill backprop loop that floods every parity-even void in the first step and sharpens the interior with violet accents when you increase the step count, while Sierpinski-Zeta folds that lattice into a harmonic zeta(1) field with adaptive backprop smoothing the dark voids. Backwards introduces a negative move to revisit ancestors, and Divergent/Decay highlight gain and attenuation flows.
- **Projects** - Name the current configuration and save it to `localStorage`. Saved studies include logic snippets, gradient preferences, projection mode, and layout state. Load or delete entries directly from the sidebar.
- **Inspector & Analytics** - Clicking a node reveals coordinates, generation, parent/child links, and aggregated dimension metadata. Binary path analytics compute $\binom{n}{k}$ counts, 0/1 histograms, and sample enumerations; set `ENABLE_HOVER_ENUMERATION_POPUP` to `true` in `simulator.html` to mirror these details in hover tooltips.
- **Canvas Interaction** - Drag to pan, scroll to zoom. When you zoom out beyond an adaptive threshold the renderer clusters nearby nodes, tracking min/max values per bucket to keep the visualization legible.

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

### Backprop Fill Helper
The **Backprop Fill** editor compiles an auxiliary routine that you can call from your main backprop logic (or reuse elsewhere):

```js
fill(childState, parentState, context)
```

Return the same shape as the primary backprop function (`{ parent, child }` with optional `valueDelta`, `valueOverride`, and per-dimension adjustments). The simulator exposes the compiled helper via `context.reverseFill`; guard it with `typeof context.reverseFill === 'function'` before invoking. The updated Sierpinski preset uses this hook to scan parity-even holes, measure their binary depth, and set `child.valueOverride` to `2 + layer`, where layer `= min(step, depth - 1)` paints magenta (`2`), violet (`3`), and lilac (`4`) tiers as you recurse inward. The helper also inspects `context.step`, so higher backprop steps peel deeper layers of the reverse Sierpinski hierarchy without recomputing the base fill.

### Reverse Sierpinski Backprop
Load the **Sierpinski** preset and set `Backpropagation Steps` to `1` to flood every parity-even void with the magenta base fill (value `2`). Each additional step activates a deeper binary layer and upgrades the surviving pockets—first to violet (value `3`), then to lilac (value `4`). Because the helper gates on `context.step`, you can jump directly to any depth—the pass only touches holes whose bit-depth still exceeds the requested step.

### Color and HDR Logic
Customize visualization with:

```js
color(value, stats, range, context)
hdr(input, context)
```

`context` exposes the current zoom `scale` so you can adjust palettes or intensify highlights when zoomed out. The default HDR function uses a logarithmic shoulder with gamma mixing to preserve contrast across large spans.

### Position Logic
Override lattice coordinates via the Projection editor:

```js
position(key, coords, node, context)
```

`coords` carries the default `{ x, y, z }` lattice location, `node` is a snapshot of the pending node (value, dimensions, parents, children, path metadata, and original position), and `context` augments your inputs with `key`, `coords`, `generation`, `parents`, and the current phase (`seed`, `forward`, or `merge`). Return a `{ x, y, z }` object to relocate the node in Cartesian space"missing components fall back to the defaults.

Set the projection mode dropdown to "Custom JS" whenever you want this function to run. Switching back to "Grid (planar)" or "Isometric" hides the spatial editors, clears the worker overrides, and restores the stock lattice layout. The dropdown value is persisted with saved projects and presets.

### Space Distortion
Modify per-branch transmission before reunification:

```js
spaceDistortion(baseResult, context)
```

`baseResult` is either `null` or the normalized dimension packet `{ value, isActive, contributors, meta }` produced by the propagation function. `context` supplies `parentSnapshot` (a full state clone), `childKey`, `childCoords`, `generation`, `moveIndex`, `move`, `dimensionKey`, and the raw propagation output. Return `undefined` to keep the original packet, `null` to drop the contribution, or a number/object that will be normalized into a new packet. This hook is only active while the projection mode is set to Custom JS.

## Rendering & Performance Notes
- `GridSimulatorApp` persists layout preferences (`gridSimEditorHeight`, `gridSimSidebarWidth`, `gridSimEditorCollapsed`) and restores them on boot before the editors mount.
- The renderer blends global min/max values with viewport samples to compute gradient spans, ensuring zoomed-in detail matches the overall grid context.
- When `view.scale` drops below `AGGREGATION_SCALE_THRESHOLD`, nodes are bucketed into screen-space tiles and drawn as aggregated blobs, dramatically improving performance on large generation counts.
- Default color ramps interpolate between curated warm/cool palettes, but you can rewrite them entirely from the color logic editor.

## Simulation Lifecycle (Technical Overview)
- `updateConfigFromUI` validates moves, compiles user snippets with `new Function`, and stores both source strings and executable callbacks in `app.config`. Propagation dimensions are keyed (primary/secondary by default) so downstream rendering can introspect them.
- `generateGrid` performs the forward sweep: it clones parent dimensions, invokes each propagation function, accumulates child contributions, chooses a reunification result, and computes the effective value. Binary path metadata is tracked whenever only two moves are active, enabling $C(n,k)$ analytics without extra computation.
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
The simulator stores sample enumerations of the binary strings that reach a node. Conceptually we permute a base string with $k$ ones and $n-k$ zeros to enumerate all coincident histories"mirroring the permutations described in the discourse section of the research notes.

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
This preset turns the binary Pascal lattice into a harmonic sampler that mirrors the blow-up of the Riemann zeta function at $s = 1$. It combines three ideas: a parity mask that produces the Sierpinski gasket, a truncated harmonic series that approximates $\zeta(1)$, and a backpropagation pass that regularizes the "holes" while the renderer maps amplitudes to gradients.

**Parity-driven lattice.** The primary propagation in `simulator.html:->presets.sierpinskiZeta.propagation` reduces the effective binomial coefficient to a parity bit

$$
p_{n,k} = \binom{n}{k} \bmod 2,
$$

so only the odd coefficients survive. Lucas' theorem tells us the surviving coordinates $(n,k)$ form the classic Sierpinski triangle. These cells are the scaffolding on which the divergent signal will ride.

**Sampling $\zeta(1)$ via harmonic partial sums.** For a node at generation $n$ the effective-value logic (see `simulator.html:->presets.sierpinskiZeta.effective`) accumulates the truncated harmonic number

$$
H_{m(n)} = \sum_{r=1}^{m(n)} \frac{1}{r}, \qquad m(n) = \min\{256, \max(2, n+2)\},
$$

which grows like $\log m + \gamma$ and therefore encodes the pole of $\zeta(s)$ at $s=1$. Each active node scales this divergence by a warp term $W_{n,k}$ composed of smooth sine/cosine envelopes that depend on the integer coordinates $(x,y)$ and the generation. The rendered scalar is therefore

$$
V_{n,k} = \begin{cases}
 H_{m(n)} \; W_{n,k}, & p_{n,k} = 1, \\
 -\beta_{n,k} H_{m(n)} \; W_{n,k}, & p_{n,k} = 0,
\end{cases}
$$

where $\beta_{n,k}$ is the hole boost chosen in `simulator.html->presets.sierpinskiZeta.effective` to keep voids in tension with their odd neighbours. In effect the positive lobes trace the divergent harmonic envelope while the negative wells record the compensating deficit.

**Backpropagated regularization.** The single backprop loop (`simulator.html->presets.sierpinskiZeta.backprop`) nudges the parity-even sites toward

$$
V^{\text{target}}_{n,k} = -\beta_{n,k} H_{m(n)},
$$

by applying a local correction

$$
\Delta V = 0.3 \left( V^{\text{target}}_{n,k} - V_{n,k}\right).
$$

The correction is skipped for parity-odd nodes, so the Sierpinski mask stays intact. This light-touch feedback keeps the gradient finite and readable despite the underlying divergence.

**Spatial and chromatic projection.** The position logic (`simulator.html->presets.sierpinskiZeta.positionLogic`) lays out nodes using

$$
\bigl( x, y \bigr) = \left( 1.12\,n + f_{\text{skew}}(x,y),\; -0.88\,V_{n,k} + 0.12\,H_{m(n)} + f_{\text{spiral}}(x,y,n) \right),
$$

so vertical displacement directly reflects the sampled zeta amplitude while logarithmic spirals keep distant generations legible. Finally the color logic (`simulator.html:->presets.sierpinskiZeta.colorLogic`) converts the signed magnitude

$$
\alpha = \frac{|V_{n,k}|}{\max(|V_{\min}|, |V_{\max}|, 1)}
$$

into an HSL triplet: positive values drift from teal to cyan as $\alpha$ grows, negative values slide toward magenta-black. The resulting canvas is a color-gradient plot of the truncated $\zeta(1)$ reach across the Sierpinski lattice, with the backpropagated voids completing the continuous banding around the pole.

## Configuration Flags
- `ENABLE_HOVER_ENUMERATION_POPUP`: toggled in `simulator.html` to mirror inspector enumerations as hover tooltips on the canvas and lineage chips.

## Extending the Project
- Mirror or tweak existing presets to package new lesson plans or research scenarios.
- Host the CodeMirror assets locally for offline workshops.
- Because everything is in `simulator.html`, it is straightforward to bolt on export routines, additional analytics panels, or automated sweeps that iterate over logic presets.
