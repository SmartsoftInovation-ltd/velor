import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Browser storage must be namespaced per store.
 *
 * `clearTenantStorage()` only removes keys under the `t:<workspace>:` prefix, so
 * a key written without `scopedStorageKey()` survives a sign-out and reappears
 * in the next store signed in on the same browser. That has produced real bugs:
 * one store's queued barcode labels showing up on another store's screen, and a
 * courier merchant id from store A being posted as store B's merchant.
 *
 * This walks the source and fails on any storage write whose key is not scoped,
 * so the next one is caught at review time rather than in production.
 */

const SRC = join(__dirname, "..");

// Keys that are deliberately global, each with the reason it is safe
const ALLOWED = new Map<string, string>([
  ["ACCESS_TOKEN_KEY", "the session token itself; cleared on sign-out and on forced logout"],
  ["TOKEN_KEY", "the platform operator token; cleared when the operator signs out of the console"],
  ["WORKSPACE_KEY", "the workspace name — the thing every other key is scoped BY"],
  ["'theme'", "a display preference belonging to the browser, not to any store"],
  ['"theme"', "a display preference belonging to the browser, not to any store"],
]);

const sourceFiles = (dir: string, found: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "test") sourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
};

// localStorage.setItem(<key>, …) / sessionStorage.setItem(<key>, …)
// The key may itself be a call, so balance one level of parentheses.
const WRITE = /\b(?:local|session)Storage\.(?:setItem|removeItem)\(\s*((?:[^,()]|\([^()]*\))+)/g;

const unscopedWrites = () => {
  const offenders: string[] = [];

  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    // session.ts defines the scoping helpers themselves
    if (file.endsWith(join("lib", "session.ts"))) continue;

    for (const [, rawKey] of source.matchAll(WRITE)) {
      const key = rawKey.trim();
      if (key.includes("scopedStorageKey") || /Key\(\)$/.test(key) || /^draftKey\(/.test(key)) continue;
      if ([...ALLOWED.keys()].some((allowed) => key.includes(allowed))) continue;
      offenders.push(`${file.replace(SRC, "src")}: ${key}`);
    }
  }

  return offenders;
};

describe("browser storage is namespaced per store", () => {
  it("finds the storage writes it is meant to be checking", () => {
    // Guards against the regex silently matching nothing after a refactor
    const source = sourceFiles(SRC)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect([...source.matchAll(WRITE)].length).toBeGreaterThan(10);
  });

  it("every storage write uses a scoped key", () => {
    expect(unscopedWrites()).toEqual([]);
  });
});
