import { describe, it, expect, beforeEach } from "vitest";
import {
  tryCooldown,
  resetCooldown,
  COOLDOWN,
} from "@/lib/client-cooldown";

describe("client-cooldown", () => {
  beforeEach(() => {
    resetCooldown("k");
  });

  it("permite a primeira chamada", () => {
    expect(tryCooldown("k", 1000)).toBe(true);
  });

  it("bloqueia chamada subsequente dentro da janela", () => {
    expect(tryCooldown("k", 1000)).toBe(true);
    const r = tryCooldown("k", 1000);
    expect(typeof r).toBe("number");
    expect(r).toBeLessThanOrEqual(1000);
    expect(r).toBeGreaterThan(0);
  });

  it("expõe janelas padronizadas", () => {
    expect(COOLDOWN.generateScripts).toBeGreaterThan(0);
    expect(COOLDOWN.heygenGenerate).toBeGreaterThan(0);
  });

  it("isola chaves diferentes", () => {
    expect(tryCooldown("a", 1000)).toBe(true);
    expect(tryCooldown("b", 1000)).toBe(true);
  });
});