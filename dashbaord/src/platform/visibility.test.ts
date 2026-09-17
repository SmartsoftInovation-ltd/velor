import { describe, expect, it } from "vitest";
import { canSeePlatformConsole, platformWorkspaces } from "./visibility";

describe("Platform Console visibility", () => {
  it("parses the configured platform workspaces", () => {
    expect(platformWorkspaces(" Velor, ecompos-hq ,")).toEqual(["velor", "ecompos-hq"]);
    expect(platformWorkspaces(undefined)).toEqual([]);
  });

  it("shows the console to the owner of the platform workspace", () => {
    expect(canSeePlatformConsole({ workspace: "velor", isOwner: true, allowed: ["velor"] })).toBe(true);
  });

  it("hides the console from sellers and from platform staff who are not the owner", () => {
    expect(canSeePlatformConsole({ workspace: "pizzashop", isOwner: true, allowed: ["velor"] })).toBe(false);
    expect(canSeePlatformConsole({ workspace: "velor", isOwner: false, allowed: ["velor"] })).toBe(false);
    expect(canSeePlatformConsole({ workspace: null, isOwner: true, allowed: [] })).toBe(false);
  });
});
