'use strict';

const ENUMERATION_SAMPLE_LIMIT = 32;

self.onmessage = (event) => {
    const data = event.data || {};
    if (data.type !== 'compute') {
        return;
    }
    try {
        const result = computeGridPayload(data.payload || {});
        self.postMessage({ type: 'result', requestId: data.requestId, result });
    } catch (error) {
        self.postMessage({
            type: 'error',
            requestId: data.requestId,
            error: serializeWorkerError(error),
        });
    }
};

function serializeWorkerError(error) {
    if (!error) {
        return { message: 'Unknown worker error', stack: null };
    }
    if (typeof error === 'string') {
        return { message: error, stack: null };
    }
    return {
        message: error.message || String(error),
        stack: error.stack || null,
    };
}

function computeGridPayload(payload) {
    const config = hydrateConfig(payload);
    const kernel = createKernel(config);
    return kernel.run();
}

function hydrateConfig(payload) {
    const safePayload = payload || {};
    const safeMoves = Array.isArray(safePayload.moves) ? safePayload.moves : [];
    const propagationDefs = Array.isArray(safePayload.propagation) ? safePayload.propagation : [];

    const propagationDimensions = propagationDefs.map((definition) => {
        const source = typeof definition.source === 'string' ? definition.source : '';
        let fn;
        try {
            fn = new Function(
                'parentValue',
                'parentDimensions',
                'index',
                'move',
                'context',
                `return (() => { ${source} })();`,
            );
        } catch (error) {
            fn = () => null;
            console.warn('Propagation logic compilation failed in worker', error);
        }
        return {
            key: definition.key,
            source,
            defaultValue: Number.isFinite(definition.defaultValue) ? definition.defaultValue : 0,
            defaultActive: definition.defaultActive === true,
            fn,
        };
    });

    let reunificationFn = null;
    const reunificationMode = safePayload.reunification?.mode || 'sum';
    const reunificationSource = safePayload.reunification?.source || '';
    if (reunificationMode === 'personalized' && reunificationSource) {
        try {
            reunificationFn = new Function(
                'values',
                'context',
                `return (() => { ${reunificationSource} })();`,
            );
        } catch (error) {
            reunificationFn = null;
            console.warn('Reunification logic compilation failed in worker', error);
        }
    }

    let effectiveValueFn = null;
    if (typeof safePayload.effectiveValueSource === 'string') {
        try {
            effectiveValueFn = new Function(
                'dimensions',
                'context',
                `return (() => { ${safePayload.effectiveValueSource} })();`,
            );
        } catch (error) {
            effectiveValueFn = null;
            console.warn('Effective value logic compilation failed in worker', error);
        }
    }

    let backpropFn = null;
    if (typeof safePayload.backpropSource === 'string') {
        try {
            backpropFn = new Function(
                'childState',
                'parentState',
                'context',
                `return (() => { ${safePayload.backpropSource} })();`,
            );
        } catch (error) {
            backpropFn = null;
            console.warn('Backprop logic compilation failed in worker', error);
        }
    }

    let backpropFillFn = null;
    if (typeof safePayload.backpropFillSource === 'string') {
        try {
            backpropFillFn = new Function(
                'childState',
                'parentState',
                'context',
                `return (() => { ${safePayload.backpropFillSource} })();`,
            );
        } catch (error) {
            backpropFillFn = null;
            console.warn('Backprop fill helper compilation failed in worker', error);
        }
    }

    let positionFn = null;
    if (typeof safePayload.positionSource === 'string' && safePayload.positionSource.trim().length) {
        try {
            positionFn = new Function(
                'key',
                'coords',
                'node',
                'context',
                `return (() => { ${safePayload.positionSource} })();`,
            );
        } catch (error) {
            positionFn = null;
            console.warn('Position logic compilation failed in worker', error);
        }
    }

    let spaceDistortionFn = null;
    if (typeof safePayload.spaceDistortionSource === 'string' && safePayload.spaceDistortionSource.trim().length) {
        try {
            spaceDistortionFn = new Function(
                'baseResult',
                'context',
                `return (() => { ${safePayload.spaceDistortionSource} })();`,
            );
        } catch (error) {
            spaceDistortionFn = null;
            console.warn('Space distortion logic compilation failed in worker', error);
        }
    }

    const dimensionDefaults = safePayload.dimensionDefaults && typeof safePayload.dimensionDefaults === 'object'
        ? safePayload.dimensionDefaults
        : {};

    const backpropStepModes = Array.isArray(safePayload.backpropStepModes)
        ? safePayload.backpropStepModes.filter((mode) => typeof mode === 'string')
        : null;

    return {
        binaryEnumerationSupported: Boolean(safePayload.binaryEnumerationSupported),
        generations: Number.isFinite(safePayload.generations) ? safePayload.generations : 0,
        moves: safeMoves
            .filter((move) => Array.isArray(move) && move.length >= 2)
            .map(([dx, dy]) => [Number(dx) || 0, Number(dy) || 0]),
        propagationDimensions,
        reunification: reunificationMode,
        reunificationFn,
        effectiveValueFn,
        backpropFn,
        backpropFillFn,
        backpropSteps: Number.isFinite(safePayload.backpropSteps) ? safePayload.backpropSteps : 0,
        backpropStepModes,
        dimensionDefaults,
        positionFn,
        spaceDistortionFn,
    };
}

function createKernel(config) {
    const grid = new Map();
    const binaryEnumerationSupported = Boolean(config.binaryEnumerationSupported);

    function getDimensionDefaults(key) {
        return config.dimensionDefaults?.[key] || {};
    }

    function createEmptyDimensionState(key) {
        const defaults = getDimensionDefaults(key);
        return {
            value: Number.isFinite(defaults.value) ? defaults.value : 0,
            isActive: defaults.isActive === true,
            contributors: Number.isFinite(defaults.contributors) ? defaults.contributors : 0,
            meta: [],
        };
    }

    function createInitialDimensions() {
        const dimensions = {};
        if (!Array.isArray(config.propagationDimensions)) return dimensions;
        config.propagationDimensions.forEach((dimension) => {
            dimensions[dimension.key] = {
                value: Number.isFinite(dimension.defaultValue) ? dimension.defaultValue : 0,
                isActive: dimension.defaultActive === true,
                contributors: dimension.defaultActive ? 1 : 0,
                meta: [],
            };
        });
        return dimensions;
    }

    function cloneDimensions(dimensions) {
        if (!dimensions) return {};
        const clone = {};
        Object.entries(dimensions).forEach(([key, payload]) => {
            clone[key] = {
                value: Number.isFinite(payload?.value) ? payload.value : 0,
                isActive: Boolean(payload?.isActive),
                contributors: Number.isFinite(payload?.contributors) ? payload.contributors : 0,
                meta: Array.isArray(payload?.meta) ? payload.meta.slice() : [],
            };
        });
        return clone;
    }

    function normalizeDimensionResult(raw) {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'number') {
            if (!Number.isFinite(raw)) return null;
            return { value: raw, isActive: true, contributors: 1, meta: [] };
        }
        if (typeof raw === 'object') {
            const value = Number.isFinite(raw.value) ? raw.value : 0;
            const isActive = raw.isActive !== false;
            const contributors = Number.isFinite(raw.contributors) ? raw.contributors : 1;
            let meta = [];
            if (raw.meta !== undefined) {
                meta = Array.isArray(raw.meta) ? raw.meta.slice() : [raw.meta];
            }
            return { value, isActive, contributors, meta };
        }
        return null;
    }

    function parseNodeKey(nodeKey) {
        if (typeof nodeKey !== 'string') {
            return { x: 0, y: 0 };
        }
        const parts = nodeKey.split(',');
        if (parts.length < 2) {
            const numeric = Number(nodeKey);
            if (Number.isFinite(numeric)) {
                return { x: numeric, y: 0 };
            }
            return { x: 0, y: 0 };
        }
        const x = Number(parts[0]);
        const y = Number(parts[1]);
        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
        };
    }

    function computeBinaryLatticeMetrics(nodeKey, node) {
        if (!nodeKey) return null;
        const coords = parseNodeKey(nodeKey);
        const rawRow = Number.isFinite(node?.generation)
            ? node.generation
            : Number.isFinite(node?.gen)
                ? node.gen
                : coords.x;
        const row = Number.isFinite(rawRow) ? rawRow : coords.x;
        if (!Number.isFinite(row) || row < 0) return null;
        const colRaw = (row + coords.y) / 2;
        if (!Number.isFinite(colRaw)) return null;
        const col = Math.round(colRaw);
        if (col < 0 || col > row) {
            return {
                coords,
                row,
                col,
                leftMoves: row - col,
                rightMoves: col,
                conflict: 0,
                highestBit: 0,
                layerDepth: -1,
                orientationReverse: false,
                orientationForward: false,
            };
        }
        const leftMoves = row - col;
        const rightMoves = col;
        const conflict = leftMoves & rightMoves;
        if (conflict === 0) {
            return {
                coords,
                row,
                col,
                leftMoves,
                rightMoves,
                conflict: 0,
                highestBit: 0,
                layerDepth: -1,
                orientationReverse: false,
                orientationForward: false,
            };
        }
        const exponent = Math.floor(Math.log2(conflict));
        const highestBit = exponent >= 0 ? (1 << exponent) : 0;
        const mask = highestBit > 0 ? highestBit - 1 : 0;
        const apexLeft = leftMoves & ~mask;
        const apexRight = rightMoves & ~mask;
        const localLeft = leftMoves - apexLeft;
        const localRight = rightMoves - apexRight;
        const orientationReverse = (localLeft & localRight) === 0;
        const mirroredLeft = mask >= 0 ? (mask - localLeft) : 0;
        const mirroredRight = mask >= 0 ? (mask - localRight) : 0;
        const orientationForward = mask >= 0 && ((mirroredLeft & mirroredRight) === 0);
        return {
            coords,
            row,
            col,
            leftMoves,
            rightMoves,
            conflict,
            highestBit,
            mask,
            apexLeft,
            apexRight,
            localLeft,
            localRight,
            mirroredLeft,
            mirroredRight,
            layerDepth: exponent,
            orientationReverse,
            orientationForward,
        };
    }

    function createNodeSnapshot(nodeKey, node) {
        if (!node) return null;
        return {
            key: nodeKey,
            value: Number.isFinite(node.value) ? node.value : 0,
            gen: Number.isFinite(node.gen) ? node.gen : 0,
            generation: Number.isFinite(node.gen) ? node.gen : 0,
            parents: Array.isArray(node.parents) ? node.parents.slice() : [],
            children: Array.isArray(node.children) ? node.children.slice() : [],
            dimensions: cloneDimensions(node.dimensions),
            position: node.position && typeof node.position === 'object'
                ? {
                    x: Number.isFinite(node.position.x) ? node.position.x : 0,
                    y: Number.isFinite(node.position.y) ? node.position.y : 0,
                    z: Number.isFinite(node.position.z) ? node.position.z : 0,
                }
                : { x: 0, y: 0, z: 0 },
            pathMeta: node.pathMeta || null,
        };
    }

    function applySpaceDistortion(baseResult, context, rawOutput) {
        if (typeof config.spaceDistortionFn !== 'function') return baseResult;
        try {
            const result = config.spaceDistortionFn(
                baseResult
                    ? {
                        value: baseResult.value,
                        isActive: baseResult.isActive,
                        contributors: baseResult.contributors,
                        meta: Array.isArray(baseResult.meta) ? baseResult.meta.slice() : [],
                    }
                    : null,
                {
                    ...context,
                    rawOutput,
                    baseResult: baseResult
                        ? {
                            value: baseResult.value,
                            isActive: baseResult.isActive,
                            contributors: baseResult.contributors,
                            meta: Array.isArray(baseResult.meta) ? baseResult.meta.slice() : [],
                        }
                        : null,
                },
            );
            if (result === undefined) return baseResult;
            if (result === null) return null;
            if (typeof result === 'number' || typeof result === 'object') {
                return normalizeDimensionResult(result);
            }
        } catch (error) {
            console.warn('Space distortion logic error (worker)', error);
        }
        return baseResult;
    }

    function buildReunificationContext(values) {
        const count = values.length;
        if (!count) {
            return { count: 0, sum: 0, average: 0, min: 0, max: 0 };
        }
        let sum = 0;
        let min = values[0];
        let max = values[0];
        for (let i = 0; i < count; i += 1) {
            const value = values[i];
            sum += value;
            if (value < min) min = value;
            if (value > max) max = value;
        }
        const average = sum / count;
        return { count, sum, average, min, max };
    }

    function combineValuesByReunification(values) {
        if (!values.length) return 0;
        if (config.reunification === 'personalized') {
            const safeValues = values.slice();
            const context = buildReunificationContext(safeValues);
            if (typeof config.reunificationFn === 'function') {
                try {
                    const result = config.reunificationFn(safeValues, context);
                    if (Number.isFinite(result)) return result;
                } catch (error) {
                    console.warn('Custom reunification logic error (worker)', error);
                }
            }
            return context.sum;
        }
        switch (config.reunification) {
            case 'average':
                return values.reduce((sum, value) => sum + value, 0) / values.length;
            case 'max':
                return Math.max(...values);
            case 'sum':
            default:
                return values.reduce((sum, value) => sum + value, 0);
        }
    }

    function mergeIncomingDimensionResults(incoming) {
        const aggregates = new Map();
        incoming.forEach((entry) => {
            const dimensionResults = entry.dimensions || {};
            Object.entries(dimensionResults).forEach(([key, result]) => {
                if (!aggregates.has(key)) {
                    aggregates.set(key, { values: [], activeCount: 0, contributors: 0, meta: [] });
                }
                const bucket = aggregates.get(key);
                if (result && Number.isFinite(result.value)) {
                    bucket.values.push(result.value);
                    bucket.contributors += Number.isFinite(result.contributors) ? result.contributors : 1;
                }
                if (result && result.isActive) bucket.activeCount += 1;
                if (result && result.meta) {
                    const meta = Array.isArray(result.meta) ? result.meta : [result.meta];
                    meta.forEach((item) => {
                        if (item !== undefined) bucket.meta.push(item);
                    });
                }
            });
        });

        if (Array.isArray(config.propagationDimensions)) {
            config.propagationDimensions.forEach((dimension) => {
                if (!aggregates.has(dimension.key)) {
                    aggregates.set(dimension.key, { values: [], activeCount: 0, contributors: 0, meta: [] });
                }
            });
        }

        aggregates.forEach((bucket) => {
            bucket.value = combineValuesByReunification(bucket.values);
            if (!Number.isFinite(bucket.contributors) || bucket.contributors <= 0) {
                bucket.contributors = bucket.values.length;
            }
        });

        return aggregates;
    }

    function finalizeDimensionAggregates(aggregates) {
        const result = {};
        aggregates.forEach((bucket, key) => {
            result[key] = {
                value: Number.isFinite(bucket.value) ? bucket.value : 0,
                isActive: bucket.activeCount > 0,
                contributors: Number.isFinite(bucket.contributors)
                    ? bucket.contributors
                    : (Array.isArray(bucket.values) ? bucket.values.length : 0),
                meta: Array.isArray(bucket.meta) ? bucket.meta.slice() : [],
            };
        });
        return result;
    }

    function mergeDimensionStates(existing, incoming) {
        const base = cloneDimensions(existing);
        Object.entries(incoming || {}).forEach(([key, addition]) => {
            const current = base[key] || createEmptyDimensionState(key);
            const valueDelta = Number.isFinite(addition?.value) ? addition.value : 0;
            current.value += valueDelta;
            current.isActive = current.isActive || Boolean(addition?.isActive);
            const contributorDelta = Number.isFinite(addition?.contributors)
                ? addition.contributors
                : (valueDelta !== 0 ? 1 : 0);
            current.contributors += contributorDelta;
            if (Array.isArray(addition?.meta) && addition.meta.length) {
                current.meta.push(...addition.meta);
            }
            base[key] = current;
        });
        return base;
    }

    function evaluateEffectiveValue(dimensions, context = {}) {
        const safeDimensions = dimensions || {};
        try {
            if (typeof config.effectiveValueFn === 'function') {
                const dimensionKeys = Array.isArray(config.propagationDimensions)
                    ? config.propagationDimensions.map((d) => d.key)
                    : Object.keys(safeDimensions);
                const result = config.effectiveValueFn(safeDimensions, { ...context, dimensionKeys });
                if (Number.isFinite(result)) return result;
            }
        } catch (error) {
            console.warn('Effective value logic error (worker)', error);
        }
        const primary = safeDimensions.primary;
        if (primary && Number.isFinite(primary.value)) return primary.value;
        const fallbackKey = Object.keys(safeDimensions)[0];
        if (fallbackKey) {
            const candidate = safeDimensions[fallbackKey];
            if (candidate && Number.isFinite(candidate.value)) return candidate.value;
        }
        return 0;
    }

    function createRootPathMeta() {
        return {
            depth: 0,
            total: 1,
            onesHistogram: { 0: 1 },
            samples: [''],
            sampleComplete: true,
        };
    }

    function clonePathMeta(meta) {
        if (!meta) return null;
        return {
            depth: meta.depth,
            total: meta.total,
            onesHistogram: Object.fromEntries(
                Object.entries(meta.onesHistogram || {}).map(([key, value]) => [Number(key), value]),
            ),
            samples: Array.isArray(meta.samples) ? meta.samples.slice() : [],
            sampleComplete: Boolean(meta.sampleComplete),
        };
    }

    function advancePathMeta(parentMeta, branchIndex) {
        if (!parentMeta || typeof parentMeta !== 'object') return null;
        const nextDepth = parentMeta.depth + 1;
        const onesIncrement = branchIndex === 1 ? 1 : 0;
        const onesHistogram = {};
        Object.entries(parentMeta.onesHistogram || {}).forEach(([key, count]) => {
            const ones = Number(key);
            const nextOnes = ones + onesIncrement;
            onesHistogram[nextOnes] = (onesHistogram[nextOnes] || 0) + count;
        });
        let samples = [];
        let sampleComplete = parentMeta.sampleComplete;
        if (Array.isArray(parentMeta.samples) && parentMeta.samples.length) {
            samples = parentMeta.samples.map((sample) => `${sample}${branchIndex === 1 ? '1' : '0'}`);
            if (samples.length > ENUMERATION_SAMPLE_LIMIT) {
                samples = samples.slice(0, ENUMERATION_SAMPLE_LIMIT);
                sampleComplete = false;
            }
        }
        return {
            depth: nextDepth,
            total: parentMeta.total,
            onesHistogram,
            samples,
            sampleComplete,
        };
    }

    function mergeUniqueSamples(a = [], b = []) {
        const merged = [...a, ...b];
        const seen = new Set();
        const result = [];
        merged.forEach((sample) => {
            if (typeof sample !== 'string') return;
            if (seen.has(sample)) return;
            seen.add(sample);
            result.push(sample);
        });
        return result.sort();
    }

    function mergePathMetas(baseMeta, additionMeta) {
        if (!additionMeta) return baseMeta ? clonePathMeta(baseMeta) : null;
        if (!baseMeta) return clonePathMeta(additionMeta);
        const merged = {
            depth: Math.max(baseMeta.depth, additionMeta.depth),
            total: baseMeta.total + additionMeta.total,
            onesHistogram: {},
            samples: [],
            sampleComplete: false,
        };
        const keys = new Set([
            ...Object.keys(baseMeta.onesHistogram || {}),
            ...Object.keys(additionMeta.onesHistogram || {}),
        ]);
        keys.forEach((key) => {
            const numeric = Number(key);
            merged.onesHistogram[numeric] =
                (baseMeta.onesHistogram?.[numeric] || 0) + (additionMeta.onesHistogram?.[numeric] || 0);
        });
        const combinedSamples = mergeUniqueSamples(baseMeta.samples || [], additionMeta.samples || []);
        if (
            combinedSamples.length <= ENUMERATION_SAMPLE_LIMIT &&
            baseMeta.sampleComplete &&
            additionMeta.sampleComplete &&
            merged.total <= ENUMERATION_SAMPLE_LIMIT
        ) {
            merged.samples = combinedSamples;
            merged.sampleComplete = true;
        } else {
            merged.samples = combinedSamples.slice(0, ENUMERATION_SAMPLE_LIMIT);
            merged.sampleComplete = false;
        }
        return merged;
    }

    function buildBackpropState(nodeKey, node) {
        return {
            key: nodeKey,
            value: Number.isFinite(node.value) ? node.value : 0,
            dimensions: cloneDimensions(node.dimensions || createInitialDimensions()),
            generation: node.gen,
        };
    }

    function accumulateNodeUpdate(container, nodeKey, update) {
        if (!update || typeof update !== 'object') return;
        if (!container.has(nodeKey)) {
            container.set(nodeKey, {
                valueDelta: 0,
                valueOverride: null,
                dimensions: new Map(),
            });
        }
        const entry = container.get(nodeKey);
        if (typeof update.valueOverride === 'number' && Number.isFinite(update.valueOverride)) {
            entry.valueOverride = update.valueOverride;
        } else if (typeof update.valueDelta === 'number' && Number.isFinite(update.valueDelta)) {
            entry.valueDelta += update.valueDelta;
        }
        if (update.dimensions && typeof update.dimensions === 'object') {
            Object.entries(update.dimensions).forEach(([key, delta]) => {
                const numericDelta = Number(delta);
                if (!Number.isFinite(numericDelta)) return;
                entry.dimensions.set(key, (entry.dimensions.get(key) || 0) + numericDelta);
            });
        }
    }

    function applyAccumulatedUpdates(updateMap, step) {
        updateMap.forEach((descriptor, nodeKey) => {
            const node = grid.get(nodeKey);
            if (!node) return;
            Object.entries(Object.fromEntries(descriptor.dimensions.entries())).forEach(([dimensionKey, delta]) => {
                if (!node.dimensions) node.dimensions = createInitialDimensions();
                if (!node.dimensions[dimensionKey]) {
                    node.dimensions[dimensionKey] = createEmptyDimensionState(dimensionKey);
                }
                node.dimensions[dimensionKey].value += delta;
                node.dimensions[dimensionKey].contributors += 1;
            });
            let baseValue = evaluateEffectiveValue(node.dimensions, {
                key: nodeKey,
                generation: node.gen,
                phase: 'backprop',
                step,
            });
            Object.entries(Object.fromEntries(descriptor.dimensions.entries())).forEach(([dimensionKey, delta]) => {
                const value = Number(delta);
                if (!Number.isFinite(value)) return;
                const deltaState = {};
                deltaState[dimensionKey] = {
                    value,
                    isActive: true,
                    contributors: 1,
                    meta: [],
                };
                node.dimensions = mergeDimensionStates(node.dimensions, deltaState);
                baseValue = evaluateEffectiveValue(node.dimensions, {
                    key: nodeKey,
                    generation: node.gen,
                    phase: 'backprop',
                    step,
                });
            });
            if (descriptor.valueOverride !== null && Number.isFinite(descriptor.valueOverride)) {
                node.value = descriptor.valueOverride;
            } else {
                const delta = Number.isFinite(descriptor.valueDelta) ? descriptor.valueDelta : 0;
                const nextValue = baseValue + delta;
                node.value = Number.isFinite(nextValue) ? nextValue : baseValue;
            }
            if (!Number.isFinite(node.value)) {
                node.value = 0;
            }
        });
    }

    function applyBackpropagation(steps) {
        if (!Number.isFinite(steps) || steps <= 0 || typeof config.backpropFn !== 'function') return;
        const generationBuckets = new Map();
        grid.forEach((node, key) => {
            if (!generationBuckets.has(node.gen)) generationBuckets.set(node.gen, []);
            generationBuckets.get(node.gen).push([key, node]);
        });
        const generations = Array.from(generationBuckets.keys()).sort((a, b) => b - a);

        for (let step = 0; step < steps; step += 1) {
            const parentUpdates = new Map();
            const childUpdates = new Map();

            generations.forEach((generation) => {
                const nodes = generationBuckets.get(generation) || [];
                nodes.forEach(([childKey, childNode]) => {
                    if (!Array.isArray(childNode.parents) || !childNode.parents.length) return;
                        const lattice = computeBinaryLatticeMetrics(childKey, childNode);
                        childNode.parents.forEach((parentKey) => {
                            const parentNode = grid.get(parentKey);
                            if (!parentNode) return;
                            let result = null;
                            try {
                                const stepMode = Array.isArray(config.backpropStepModes) && config.backpropStepModes.length
                                ? config.backpropStepModes[step % config.backpropStepModes.length]
                                : null;
                            result = config.backpropFn(
                                buildBackpropState(childKey, childNode),
                                buildBackpropState(parentKey, parentNode),
                                    {
                                        generation,
                                        step,
                                        totalSteps: steps,
                                        childKey,
                                        parentKey,
                                        mode: stepMode,
                                        reverseFill: typeof config.backpropFillFn === 'function' ? config.backpropFillFn : null,
                                        lattice,
                                    },
                                );
                            } catch (error) {
                                console.warn('Backprop logic error (worker)', error);
                            }
                        if (!result) return;
                        if (result.parent) accumulateNodeUpdate(parentUpdates, parentKey, result.parent);
                        if (result.child) accumulateNodeUpdate(childUpdates, childKey, result.child);
                    });
                });
            });

            applyAccumulatedUpdates(parentUpdates, step);
            applyAccumulatedUpdates(childUpdates, step);
        }
    }

    function createPosition(key, x, y, node, context) {
        const safeCoords = {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            z: 0,
        };
        const base = { ...safeCoords };
        if (typeof config.positionFn === 'function') {
            try {
                const enrichedContext = {
                    ...(context || {}),
                    key,
                    coords: safeCoords,
                    node,
                };
                const custom = config.positionFn(
                    key,
                    safeCoords,
                    node,
                    enrichedContext,
                );
                if (custom && typeof custom === 'object') {
                    const pos = {
                        x: Number.isFinite(custom.x) ? Number(custom.x) : base.x,
                        y: Number.isFinite(custom.y) ? Number(custom.y) : base.y,
                        z: Number.isFinite(custom.z) ? Number(custom.z) : 0,
                    };
                    return pos;
                }
            } catch (error) {
                console.warn('Position logic error (worker)', error);
            }
        }
        return base;
    }

    function generateGrid() {
        grid.clear();
        const startNodeKey = '0,0';
        const rootDimensions = createInitialDimensions();
        const rootValue = evaluateEffectiveValue(rootDimensions, {
            key: startNodeKey,
            generation: 0,
            phase: 'seed',
        });
        const rootNode = {
            value: rootValue,
            dimensions: rootDimensions,
            gen: 0,
            parents: [],
            children: [],
            pathMeta: binaryEnumerationSupported ? createRootPathMeta() : null,
            position: { x: 0, y: 0, z: 0 },
        };
        rootNode.position = createPosition(startNodeKey, 0, 0, rootNode, { generation: 0, phase: 'seed', node: rootNode });
        grid.set(startNodeKey, rootNode);
        let frontier = new Set([startNodeKey]);

        for (let generationIndex = 0; generationIndex < config.generations; generationIndex += 1) {
            const nextFrontier = new Set();
            const contributions = new Map();

            frontier.forEach((parentKey) => {
                const parentNode = grid.get(parentKey);
                if (!parentNode) return;
                const [x, y] = parentKey.split(',').map(Number);
                const parentDimensions = cloneDimensions(parentNode.dimensions);

                config.moves.forEach((move, moveIndex) => {
                    const childX = x + move[0];
                    const childY = y + move[1];
                    const childKey = `${childX},${childY}`;
                    const dimensionResults = {};

                    if (Array.isArray(config.propagationDimensions)) {
                        const parentSnapshot = createNodeSnapshot(parentKey, parentNode);
                        const childCoords = { x: childX, y: childY };
                        config.propagationDimensions.forEach((dimension) => {
                            let output = null;
                            try {
                                output = dimension.fn(
                                    parentNode.value,
                                    parentDimensions,
                                    moveIndex,
                                    move,
                                    {
                                        parentKey,
                                        parentGeneration: parentNode.gen,
                                        moveIndex,
                                        move,
                                        generation: generationIndex,
                                    },
                                );
                            } catch (error) {
                                    console.warn(`Propagation "${dimension.key}" error (worker)`, error);
                                    output = null;
                                }
                            let normalizedResult = normalizeDimensionResult(output);
                            if (normalizedResult || typeof config.spaceDistortionFn === 'function') {
                                normalizedResult = applySpaceDistortion(normalizedResult, {
                                    parentKey,
                                    parentSnapshot,
                                    childKey,
                                    childCoords,
                                    generation: generationIndex,
                                    moveIndex,
                                    move,
                                    dimensionKey: dimension.key,
                                }, output);
                            }
                            dimensionResults[dimension.key] = normalizedResult;
                        });
                    }

                    if (!Array.isArray(parentNode.children)) parentNode.children = [];
                    if (!parentNode.children.includes(childKey)) parentNode.children.push(childKey);
                    if (!contributions.has(childKey)) contributions.set(childKey, []);
                    contributions.get(childKey).push({
                        parentKey,
                        moveIndex,
                        dimensions: dimensionResults,
                    });
                });
            });

            contributions.forEach((incoming, childKey) => {
                const parentKeys = Array.from(new Set(incoming.map((entry) => entry.parentKey)));
                const aggregates = mergeIncomingDimensionResults(incoming);
                const childDimensions = finalizeDimensionAggregates(aggregates);
                const effectiveValue = evaluateEffectiveValue(childDimensions, {
                    key: childKey,
                    parents: parentKeys,
                    generation: generationIndex + 1,
                    phase: 'forward',
                });

                let childPathMeta = null;
                if (binaryEnumerationSupported) {
                    incoming.forEach((entry) => {
                        const parentNode = grid.get(entry.parentKey);
                        if (!parentNode || !parentNode.pathMeta) return;
                        const advanced = advancePathMeta(parentNode.pathMeta, entry.moveIndex);
                        if (!advanced) return;
                        childPathMeta = mergePathMetas(childPathMeta, advanced);
                    });
                }

                if (grid.has(childKey)) {
                    const childNode = grid.get(childKey);
                    childNode.dimensions = mergeDimensionStates(childNode.dimensions, childDimensions);
                    childNode.value = evaluateEffectiveValue(childNode.dimensions, {
                        key: childKey,
                        parents: parentKeys,
                        generation: generationIndex + 1,
                        phase: 'merge',
                    });
                    if (!Array.isArray(childNode.parents)) childNode.parents = [];
                    parentKeys.forEach((parentKey) => {
                        if (!childNode.parents.includes(parentKey)) childNode.parents.push(parentKey);
                    });
                if (binaryEnumerationSupported && childPathMeta) {
                    childNode.pathMeta = mergePathMetas(childNode.pathMeta, childPathMeta);
                }
            } else {
                const [cx, cy] = childKey.split(',').map(Number);
                const childNode = {
                    value: effectiveValue,
                    dimensions: childDimensions,
                    gen: generationIndex + 1,
                    parents: parentKeys,
                    children: [],
                    pathMeta: binaryEnumerationSupported ? childPathMeta : null,
                    position: { x: cx, y: cy, z: 0 },
                };
                childNode.position = createPosition(childKey, cx, cy, childNode, {
                    generation: generationIndex + 1,
                    parents: parentKeys,
                    phase: 'forward',
                    node: childNode,
                });
                grid.set(childKey, childNode);
            }

                nextFrontier.add(childKey);
            });

            frontier = nextFrontier;
        }

        if (config.backpropSteps > 0 && typeof config.backpropFn === 'function') {
            applyBackpropagation(config.backpropSteps);
        }
    }

    function computeStats() {
        let min = Infinity;
        let max = -Infinity;
        grid.forEach((node) => {
            min = Math.min(min, node.value);
            max = Math.max(max, node.value);
        });
        if (!grid.size) {
            min = 0;
            max = 0;
        }
        return { min, max };
    }

    function serializeGrid() {
        const nodes = [];
        grid.forEach((node, key) => {
            nodes.push({
                key,
                value: node.value,
                dimensions: node.dimensions,
                gen: node.gen,
                parents: Array.isArray(node.parents) ? node.parents.slice() : [],
                children: Array.isArray(node.children) ? node.children.slice() : [],
                pathMeta: node.pathMeta ? clonePathMeta(node.pathMeta) : null,
                position: node.position
                    ? { x: node.position.x, y: node.position.y, z: node.position.z || 0 }
                    : { x: Number(key.split(',')[0]) || 0, y: Number(key.split(',')[1]) || 0, z: 0 },
            });
        });
        return nodes;
    }

    return {
        run() {
            generateGrid();
            return {
                nodes: serializeGrid(),
                stats: computeStats(),
                binaryEnumerationSupported,
            };
        },
    };
}
