import { describe, it, expect } from "vitest";
import { hashScript, hashScripts } from "@/lib/video-storage";
import type { Script } from "@/lib/criativo-types";

const s = (hook: string, cta: string, agitacao = ""): Script => ({
  hook,
  agitacao,
  cta,
}) as Script;

describe("video-storage hashes", () => {
  it("hashScript é determinístico", () => {
    const a = hashScript(s("oi", "compra"));
    const b = hashScript(s("oi", "compra"));
    expect(a).toBe(b);
  });

  it("hashScript muda quando o conteúdo muda", () => {
    const a = hashScript(s("oi", "compra"));
    const b = hashScript(s("oi!", "compra"));
    expect(a).not.toBe(b);
  });

  it("hashScripts é determinístico para a mesma lista", () => {
    const list = [s("a", "x"), s("b", "y")];
    expect(hashScripts(list)).toBe(hashScripts(list));
  });

  it("hashScripts muda com a ordem", () => {
    const a = hashScripts([s("a", "x"), s("b", "y")]);
    const b = hashScripts([s("b", "y"), s("a", "x")]);
    expect(a).not.toBe(b);
  });
});