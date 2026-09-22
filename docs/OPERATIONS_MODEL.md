# Operations model

The operator needs to answer nine questions quickly: who is running, what each agent is doing, recent change, pending decisions, drift/cost outliers, whether it can be stopped, why it acted, what it cost, and whether the history is provable.

Control commands are explicit and auditable. Pause stops new actions at a safe checkpoint. Resume requires a paused non-killed run and no unresolved blocking approval. Kill is terminal for that run and invalidates all workers holding an older control epoch. Approvals are durable records; an approval can authorize only the exact hashed action payload it reviewed.

The three agents intentionally have different risk surfaces: Sales Ops mutates CRM state and proposes discounts, Support Ops changes ticket/billing state, and Infrastructure Ops changes simulated production configuration and incidents.
