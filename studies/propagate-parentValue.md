The `propagate` function uses `parentValue` (singular) because its job is to describe how a **single parent node** distributes its value to its potential children. It's a "push" model, not a "pull" model.

Let's break down the two distinct stages in the simulation loop:

***

### 1. The Propagation Stage (The "Push")

This is where the `propagate(parentValue, index, move)` function is used. The simulator iterates through every node in the current generation's "frontier." For each single node (the parent), it asks:

> "Based on **your current value** (`parentValue`), how much value should you send down your **first branch** (`index = 0`), how much down your **second branch** (`index = 1`), and so on?"

The function's context is always **one parent at a time**, calculating the value for each of its individual outgoing connections.

**Analogy:** Imagine a water sprinkler (the parent node) with a value of 100 liters (`parentValue`). The `propagate` function decides how much water goes out of each individual nozzle (`index`). Nozzle 0 might get 50 liters, and nozzle 1 might get 50 liters. The calculation for each nozzle only needs to know the total water in the sprinkler, not what other sprinklers are doing.



***

### 2. The Reunification Stage (The "Gather")

This is the stage that actually handles the "double-connection" case. After the simulator has calculated all the individual values being pushed from *all* parents, it looks at each potential child node's location and asks:

> "What values are arriving at this specific coordinate `(x, y)`?"

It gathers all these incoming values into an array. For example, a node might receive `[5.5, -2.1]` from two different parents.

Then, and only then, does the **`reunification`** logic (`Sum`, `Average`, `Max`) kick in. It takes that array of incoming values and combines them to calculate the final value for the new node.

**Analogy:** A bucket (the child node) is placed where multiple sprinkler nozzles are pointing. The `reunification` stage is the process of collecting all the water that has landed in that specific bucket and measuring the final, combined total.



### Conclusion

The system uses a two-step process:

1.  **`propagate()` (Push):** Each parent individually calculates the value for its outgoing branches. It uses `parentValue` (singular) because it's only concerned with itself.
2.  **`reunification` (Gather):** Each child gathers all the values arriving from multiple parents and combines them. This is where `parentsValue` (plural, as an array) is implicitly handled.

This separation makes the system very flexible. You can define the rule for how value *changes* along a path independently from the rule for how values *combine* at an intersection.