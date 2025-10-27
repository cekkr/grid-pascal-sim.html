# Advanced Grid Propagation Simulator

This project explores how values propagate across branching lattices such as Pascal-like grids and divergent trees. It ships as a single-page simulator (`simulator.html`) tailored for experimenting with custom move sets, propagation rules, and visualization gradients.

## Highlights
- Fully interactive canvas that visualizes each generation of the propagation graph, with draggable pan and scroll-to-zoom navigation.
- Editable propagation logic and color logic using embedded CodeMirror editors for quick iteration and syntax-highlighted experimentation.
- Gradient controls that let you normalize colors symmetrically, clamp to positive/negative ranges, or enforce explicit min/max spans.
- Built-in presets that reproduce classic Pascal behaviour, divergent amplification, echo feedback loops, and decay scenarios.
- Inspector panel and local-storage projects so you can track node lineage, save studies, and reload configurations between sessions.
- Companion research notes inside `studies/` describing theoretical backgrounds and worked examples that inspired the simulator.

## Getting Started
1. Clone or download the repository.
2. Open `simulator.html` in any modern desktop browser. No build step is required.
3. Ensure the browser can reach the CodeMirror CDN (or host those assets locally if you need offline access).

## Controls Overview
- **Simulation Core**  
  Configure the number of generations to propagate and choose how multiple contributions reunify (`sum`, `average`, `max`).

- **Propagation Rules**  
  *Move Vectors* define how children spawn (`[dx, dy]`).  
  *Propagation Function* runs for each parent → child transfer with the signature `propagate(parentValue, branchIndex, moveVector)`. The default script grows the left branch and damps the right.

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
  Click nodes to inspect coordinates, generation, value, and parents. Drag to pan; scroll to zoom. The inspector can be dismissed via the close icon.

## Crafting Custom Logic
- **Propagation Function**  
  Return the value that should reach the child node. Consider multiplying, translating, or conditioning on `index` to encode branch-specific behaviour.

- **Color Logic Function**  
  Return any valid CSS color. You can build diverging palettes, threshold-based highlights, or range-dependent styling—ideal for comparing datasets or spotting anomalies.

Runtime errors inside either editor are surfaced by a red outline, and the simulator falls back to the last valid configuration so you can quickly recover.

## Reference Material
- `studies/grid-analysis-ITA.md` documents the combinatorial theory, including binomial coefficients and path enumeration.
- `studies/propagate-parentValue.md` dives deeper into how parent values influence downstream propagation in different scenarios.

Review these notes alongside the simulator to bridge theoretical formulas with visual intuition.

## Extending the Project
- Mirror the existing presets to distribute new case studies or to embed course material.
- Host the CodeMirror assets locally if you need an offline classroom setup.
- Because everything lives in `simulator.html`, you can integrate additional analytics panels or export features without a build toolchain.

Whether you are modelling Pascal’s Triangle, divergent energy flows, or custom lattices, the Advanced Grid Propagation Simulator accelerates experimentation by keeping the logic, visualization, and documentation in one place.
