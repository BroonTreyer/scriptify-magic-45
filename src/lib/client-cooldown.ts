/**
 * Cooldown client-side simples para mitigar spam de cliques em endpoints caros.
 *
 * NÃO é rate limiting de verdade — é só uma trava no navegador que impede o mesmo
 * usuário de disparar várias requests em sequência rápida. Pode ser contornado
 * facilmente. O backend hoje não tem primitivos de rate limiting.
 */

const lastCallAt = new Map<string, number>();

/**
 * Tenta consumir um cooldown para uma chave. Retorna `true` se passou (e marca o
 * timestamp), ou um número (ms restantes) se ainda está em cooldown.
 */
export function tryCooldown(key: string, windowMs: number): true | number {
  const now = Date.now();
  const last = lastCallAt.get(key) ?? 0;
  const elapsed = now - last;
  if (elapsed < windowMs) {
    return windowMs - elapsed;
  }
  lastCallAt.set(key, now);
  return true;
}

export function resetCooldown(key: string) {
  lastCallAt.delete(key);
}

/** Janelas padronizadas (ms) — ajuste sem tocar nos call-sites. */
export const COOLDOWN = {
  generateScripts: 5_000,
  heygenGenerate: 3_000,
  translate: 2_000,
  extractUrl: 2_000,
} as const;