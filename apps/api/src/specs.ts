import { readFileSync } from "node:fs";
import type { SpecBundle } from "@snowmountain/contracts";

export function loadSpecBundle(path: string): SpecBundle {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as SpecBundle;
  if (parsed.format !== "snowmountain.spec.bundle/v1" || !Array.isArray(parsed.items)) {
    throw new Error(`Invalid Spec bundle: ${path}`);
  }
  return parsed;
}
