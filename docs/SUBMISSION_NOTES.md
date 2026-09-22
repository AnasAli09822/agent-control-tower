# Submission notes

Built as a control plane rather than a chatbot. The important implementation detail is the execution boundary: every consequential tool call is checked against current policy, approval state, drift, and the worker's control epoch. Killing an agent increments that epoch, so a stale in-flight worker cannot mutate the simulated system afterward.

The replay is an operator-facing structured trace, not hidden chain-of-thought. External systems are simulated deliberately so the failure test can be destructive enough to be meaningful without touching real production accounts.
