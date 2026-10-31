/**
 * Interpreta a saída de `rea doctor --client <id> --skill --json`.
 *
 * O código de saída do REA fica != 0 quando `environment_healthy` é falso, e
 * esse campo inclui pendências que não pertencem ao escopo pedido: provedores
 * ausentes (Hopper/IDA/JADX/Kuna) e registros de outros clientes. O gate do kit
 * é `healthy: true` + todos os `scope_checks` ok.
 */

const MAX_DETAIL = 300;

function clip(text, max = MAX_DETAIL) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function summarizeDoctorScope(stdout, exitStatus, options = {}) {
  const maxPending = Number.isInteger(options.maxPending) ? options.maxPending : 4;
  const text = String(stdout || "").trim();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const first = text.split("\n").find((line) => line.trim()) || "";
    return {
      ok: exitStatus === 0,
      detail: clip(first ? `sem JSON: ${first}` : "saída vazia (código " + String(exitStatus) + ")"),
    };
  }

  const scopeChecks = Array.isArray(data.scope_checks) ? data.scope_checks.filter(Boolean) : [];
  const failingScope = scopeChecks.filter((c) => c.ok === false);
  const allChecks = Array.isArray(data.checks) ? data.checks.filter(Boolean) : [];
  const outOfScope = allChecks.filter((c) => c.ok === false);
  const ok = data.healthy === true && failingScope.length === 0;

  if (!ok) {
    const culprits = (failingScope.length ? failingScope : scopeChecks).map((c) =>
      c.detail ? `${c.name}: ${c.detail}` : String(c.name || "check")
    );
    const reason = culprits.length ? culprits.slice(0, 3).join("; ") : "healthy=false sem detalhe no escopo";
    return { ok: false, detail: clip(`escopo com problema: ${reason}`) };
  }

  let detail = "escopo ok (registro, skill e Node)";
  if (outOfScope.length) {
    const names = outOfScope.map((c) => c.name).filter(Boolean);
    const shown = names.slice(0, maxPending).join(", ");
    const extra = names.length > maxPending ? ", …" : "";
    detail += `; ${outOfScope.length} pendência(s) fora do escopo (${shown}${extra})`;
  }
  return { ok: true, detail: clip(detail) };
}
