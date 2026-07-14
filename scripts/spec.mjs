import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { parse } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = join(root, "spec/contracts");
const schemaPath = join(root, "spec/schema/snowmountain-spec.schema.json");
const projectPath = join(root, "spec/project.yaml");
const outputPath = join(root, "spec/generated/bundle.json");

function fail(message) {
  throw new Error(message);
}

async function exists(pathWithAnchor) {
  const path = pathWithAnchor.split("#", 1)[0];
  if (!path) return false;
  try { return (await stat(join(root, path))).isFile(); }
  catch { return false; }
}

function unique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`${label} contains duplicate ${value}`);
    seen.add(value);
  }
}

function validateStateMachine(document, sourcePath) {
  const { states, transitions, initial } = document.contract;
  const stateIds = states.map((state) => state.id);
  unique(stateIds, `${sourcePath} states`);
  const known = new Set(stateIds);
  if (!known.has(initial)) fail(`${sourcePath} initial state ${initial} is unknown`);
  unique(transitions.map((item) => `${item.from}:${item.event}`), `${sourcePath} transitions`);
  for (const item of transitions) {
    if (!known.has(item.from) || !known.has(item.to)) fail(`${sourcePath} transition references an unknown state`);
  }
  const reached = new Set([initial]);
  for (;;) {
    const before = reached.size;
    for (const item of transitions) if (reached.has(item.from)) reached.add(item.to);
    if (reached.size === before) break;
  }
  const unreachable = stateIds.filter((id) => !reached.has(id));
  if (unreachable.length) fail(`${sourcePath} has unreachable states: ${unreachable.join(", ")}`);
  const deadEnds = states.filter((state) => !state.terminal && !transitions.some((item) => item.from === state.id));
  if (deadEnds.length) fail(`${sourcePath} has non-terminal dead ends: ${deadEnds.map((item) => item.id).join(", ")}`);
}

function validatePolicy(document, sourcePath) {
  const subjects = new Set(document.contract.subjects.map((item) => item.id));
  const resources = new Set(document.contract.resources.map((item) => item.id));
  unique([...subjects], `${sourcePath} subjects`);
  unique([...resources], `${sourcePath} resources`);
  for (const grant of document.contract.grants) {
    if (!subjects.has(grant.subject) || !resources.has(grant.resource)) fail(`${sourcePath} grant references an unknown subject/resource`);
  }
  for (const constraint of document.contract.constraints) {
    for (const resource of constraint.resources) if (!resources.has(resource)) fail(`${sourcePath} constraint references unknown resource ${resource}`);
    if (constraint.type === "mutually-exclusive") {
      for (const subject of subjects) {
        const held = new Set(document.contract.grants.filter((grant) => grant.subject === subject && grant.access !== "none").map((grant) => grant.resource));
        if (constraint.resources.every((resource) => held.has(resource))) fail(`${sourcePath} violates ${constraint.id} for ${subject}`);
      }
    }
  }
}

function buildProjection(project, documents) {
  const items = documents.map(({ document, sourcePath, source }) => ({ ...document, sourcePath, source }));
  const features = items.flatMap((item) => item.kind === "component" ? item.contract.features.map((feature) => ({ ...feature, specId: item.metadata.id })) : []);
  const statuses = [...items.map((item) => item.metadata.status), ...features.map((item) => item.status)];
  const counts = Object.fromEntries(["planned", "partial", "implemented", "verified", "deprecated"].map((status) => [status, statuses.filter((value) => value === status).length]));
  return {
    format: "snowmountain.spec.bundle/v1",
    project,
    source: "spec/contracts/*.yaml",
    schema: "spec/schema/snowmountain-spec.schema.json",
    summary: { specs: items.length, features: features.length, statuses: counts },
    items,
    features
  };
}

async function main() {
  const mode = process.argv[2] ?? "check";
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const project = parse(await readFile(projectPath, "utf8"));
  if (project?.format !== "snowmountain.spec.project/v1" || !project.id || !project.name || !project.okfRoot || !project.contractsRoot) {
    fail("spec/project.yaml is not a valid snowmountain.spec.project/v1 manifest");
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const names = (await readdir(contractsDir)).filter((name) => name.endsWith(".yaml")).sort();
  const documents = [];
  for (const name of names) {
    const fullPath = join(contractsDir, name);
    const source = await readFile(fullPath, "utf8");
    const document = parse(source);
    const sourcePath = relative(root, fullPath);
    if (!validate(document)) fail(`${sourcePath} schema errors:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`);
    if (document.kind === "state-machine") validateStateMachine(document, sourcePath);
    if (document.kind === "capability-policy") validatePolicy(document, sourcePath);
    documents.push({ document, sourcePath, source });
  }
  unique(documents.map(({ document }) => document.metadata.id), "Spec IDs");
  const ids = new Set(documents.map(({ document }) => document.metadata.id));
  for (const { document, sourcePath } of documents) {
    for (const ref of document.specRefs ?? []) if (!ids.has(ref)) fail(`${sourcePath} references unknown Spec ${ref}`);
    const evidence = document.kind === "component"
      ? document.contract.features.flatMap((feature) => feature.evidence ?? [])
      : [];
    for (const path of [...document.knowledge, ...document.implementation.code, ...document.verification.tests, ...evidence]) {
      if (!await exists(path)) fail(`${sourcePath} references missing file ${path}`);
    }
  }
  const rendered = `${JSON.stringify(buildProjection(project, documents), null, 2)}\n`;
  if (mode === "build") {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered, "utf8");
  } else if (mode === "check") {
    const current = await readFile(outputPath, "utf8").catch(() => "");
    if (current !== rendered) fail("spec/generated/bundle.json is stale; run pnpm spec:build");
  } else fail(`Unknown mode ${mode}`);
  console.log(`Validated ${documents.length} Spec contracts (${mode})`);
}

await main();
