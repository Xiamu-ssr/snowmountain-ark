# Snowmountain Spec Profile

`spec/` is the machine-checkable alignment layer between intent and code. It is
not a second documentation bundle and it is not runtime state.

One fact has one authoritative home:

- rationale, research and reading notes live in the OKF bundle under `docs/`;
- executable semantics live in YAML contracts under `spec/contracts/`;
- implementation lives in source code;
- runtime facts live in SQLite, event streams and deployment systems;
- `spec/generated/bundle.json` and the Spec Viewer are projections generated
  from those sources and must not be edited as independent facts.

The YAML profile is deliberately small. Every document has:

- `intent`: why/outcomes, linking rather than duplicating OKF knowledge;
- `contract`: kind-specific, parseable semantics;
- `implementation`: source paths that realize the contract;
- `verification`: tests/assertions that prove it;
- `specRefs`: dependencies on other contracts.

Supported contract kinds are `state-machine`, `capability-policy`, `component`,
`data-lifecycle` and `integration`. Their syntax is defined by
`schema/snowmountain-spec.schema.json`; semantic checks such as state
reachability, reference integrity, implementation/test existence and
capability separation are enforced by `scripts/spec.mjs`.

```sh
pnpm spec:build   # validate and regenerate the viewer bundle
pnpm spec:check   # validate and fail if the generated projection drifted
```

The Viewer is content-agnostic UI. It renders the bundle returned by the API;
project names, statuses, transitions, policies, knowledge links and source YAML
all come from the data source rather than being embedded in React components.
