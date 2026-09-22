# Two-year thesis

As agents move from drafting to acting, the scarce layer will not be another agent UI. It will be operational authority: a durable control plane that answers who may act, on what, under which evidence, at what cost, and how a human can stop or override the action.

Over the next two years, companies will run heterogeneous agent fleets across sales, support, finance, and infrastructure. Model providers and agent frameworks will change quickly; control requirements will not. Operators will need a system independent of the agent runtime that can enforce scoped tools, approval policy, spend limits, drift rules, pause/kill semantics, and auditable evidence.

The durable product is therefore a runtime-neutral trust boundary. Agents propose and execute through guarded interfaces; the control plane owns authoritative state, approvals, policy, and intervention. A kill switch must be technically meaningful even during races, which is why the design invalidates worker epochs rather than relying on UI state. Reasoning replay should expose structured operational evidence, not private chain-of-thought.

If agent adoption expands as expected, this layer becomes analogous to cloud control planes and identity systems: mostly invisible when everything is healthy, essential when an autonomous worker is wrong, expensive, compromised, or simply outside its authority.
