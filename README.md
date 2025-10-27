# Advanced Grid Propagation Simulator

This project explores how values propagate across branching lattices such as Pascal-like grids and divergent trees. It ships as a single-page simulator (`simulator.html`) tailored for experimenting with custom move sets, propagation rules, and visualization gradients.

## Highlights
- Fully interactive canvas that visualizes each generation of the propagation graph, with draggable pan and scroll-to-zoom navigation.
- Multi-dimensional propagation editors that let you sculpt primary and secondary flows, blend them through an effective-value compositor, and optionally run n-step backpropagation loops.
- Editable propagation, composition, color, HDR, and backprop logic using embedded CodeMirror editors for quick iteration and syntax-highlighted experimentation.
- Gradient controls that let you normalize colors symmetrically, clamp to positive/negative ranges, or enforce explicit min/max spans.
- Built-in presets that reproduce classic Pascal behaviour, divergent amplification, echo feedback loops, and decay scenarios.
- Inspector panel with clickable lineage and local-storage projects so you can hop between parents/children, save studies, and reload configurations between sessions.
- Binary path analytics that surface C(n, k) counts, 0/1 distributions, and representative enumerations for each node.
- Companion research notes inside `studies/` describing theoretical backgrounds and worked examples that inspired the simulator.

## Getting Started
1. Clone or download the repository.
2. Open `simulator.html` in any modern desktop browser. No build step is required.
3. Ensure the browser can reach the CodeMirror CDN (or host those assets locally if you need offline access).

## Controls Overview
- **Simulation Core**  
  Configure the number of generations to propagate and choose how multiple contributions reunify (`sum`, `average`, `max`).  
  Dial in optional *Backpropagation Steps* to iteratively let child corrections influence parents (and, if desired, cascade back to children).

- **Propagation Rules**  
  *Move Vectors* define how children spawn (`[dx, dy]`).  
  *Propagation Dimensions* expose primary and secondary scripts that run per parent → child transfer with the signature `dimension(parentValue, parentDimensions, branchIndex, moveVector, context)`. Return either a number or an object such as `{ value, isActive, meta }`.  
  *Effective Final Value* receives the aggregated dimension outputs (`effectiveValue(dimensions, context)`) and resolves the scalar that drives rendering/statistics.  
  *Backpropagation Function* executes during optional rewind passes with the signature `backprop(childState, parentState, context)` and can nudge parents and descendants after the forward sweep.

- **Visualization**  
  Select the gradient scale:
  - `Symmetric ±max`: auto-normalizes around zero using the largest absolute value encountered.
  - `0 → max`: maps from zero up to the peak positive value.
  - `min → 0`: emphasizes negative basins.
  - `Custom range`: specify precise min/max bounds to compare disparate runs.
  
  The **Color Logic Function** executes with `(value, stats, range)` and must return a CSS color string. `stats` exposes overall `{min, max}`, while `range` reflects the resolved gradient span. The provided default produces warm tones for positive values and cool tones for negative values; adapt it to highlight the metrics you care about.

- **Presets**  
  Four preset buttons quickly load curated move/logic/gradient combinations for Pascal, Divergent, Echo, and Decay scenarios. Use them as launchpads for further study.

- **Projects**  
  Enter a project name to save the current configuration (including both logic scripts and gradient settings) into `localStorage`. Use the dropdown to reload or delete saved studies.

- **Canvas Interaction**  
  Click nodes to inspect coordinates, generation, value, parents, and children. The Binary Paths panel in the inspector derives C(n, k) counts and sample enumerations; set `ENABLE_HOVER_ENUMERATION_POPUP` to `true` in `simulator.html` to mirror those metrics in a hover popup. Use the inspector’s lineage chips to jump directly to any parent or child. Drag to pan; scroll to zoom. The inspector can be dismissed via the close icon.

## Crafting Custom Logic
- **Propagation Dimensions**  
  Each dimension script runs as `dimension(parentValue, parentDimensions, branchIndex, moveVector, context)`. Return either a number or an object such as `{ value, isActive, meta }`. Entries inside `parentDimensions` expose `{ value, isActive, contributors, meta }`, letting secondary channels react to the current primary flow or prior corrections.

- **Effective Value Function**  
  Compose the per-dimension aggregates with `effectiveValue(dimensions, context)` and return the scalar that should drive rendering and statistics. The default simply sums an active secondary channel into the primary value.

- **Backpropagation Function**  
  When backprop steps are enabled, `backprop(childState, parentState, context)` (with `context` exposing `generation`, `step`, `totalSteps`, and the relevant keys) can return `{ parent, child }` objects that supply `valueDelta`, `valueOverride`, and `dimensions` adjustments to gently steer parents (and optionally recondition children) after the forward sweep.

- **Color Logic Function**  
  Return any valid CSS color. You can build diverging palettes, threshold-based highlights, or range-dependent styling—ideal for comparing datasets or spotting anomalies.

- **HDR Mapping Function**  
  Shape luminance with `hdr(input, context)`; provide a value between 0 and 1 to blend subtle ranges without losing contrast.

Runtime errors inside either editor are surfaced by a red outline, and the simulator falls back to the last valid configuration so you can quickly recover.

## Reference Material
- `studies/grid-analysis-ITA.md` documents the combinatorial theory, including binomial coefficients and path enumeration.
- `studies/propagate-parentValue.md` dives deeper into how parent values influence downstream propagation in different scenarios.

Review these notes alongside the simulator to bridge theoretical formulas with visual intuition.

## Configuration Flags
- `ENABLE_HOVER_ENUMERATION_POPUP`: when toggled to `true` in `simulator.html`, hovering a node (or its related chips in the inspector) shows a floating panel with the same binary enumeration breakdown rendered in the inspector.

## Extending the Project
- Mirror the existing presets to distribute new case studies or to embed course material.
- Host the CodeMirror assets locally if you need an offline classroom setup.
- Because everything lives in `simulator.html`, you can integrate additional analytics panels or export features without a build toolchain.

Whether you are modelling Pascal’s Triangle, divergent energy flows, or custom lattices, the Advanced Grid Propagation Simulator accelerates experimentation by keeping the logic, visualization, and documentation in one place.
