import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const owner = "11111111-1111-4111-8111-111111111111";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bytes = new TextEncoder().encode("%PDF-1.7\nPrueba sin datos personales\n%%EOF");
const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
const extractionSource = stripTypeScriptTypes((await readFile(new URL("../supabase/functions/extract-invoice/index.ts", import.meta.url), "utf8")).replace(/^import .*;\n/gm, ""));
const schemaSource = stripTypeScriptTypes((await readFile(new URL("../supabase/functions/extract-invoice/schema.ts", import.meta.url), "utf8")).replace("export const invoiceSchema", "const invoiceSchema"));
const schema = new Function(schemaSource + "; return invoiceSchema;")();

function harness(options = {}) {
  let handler, calls = 0;
  const document = { id, owner_id: owner, sha256: sha, storage_path: `${owner}/${id}.pdf`, state: "pending", updated_at: "2026-10-01T00:00:00.000Z", ...options.document };
  const values = { ALLOWED_ORIGIN: "https://alihen.example", SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-service", GPT_API_KEY: "test-private", ...options.env };
  const query = () => {
    let update, filters = [];
    const object = {
      select() { return object; },
      update(data) { update = data; return object; },
      eq(key, value) { filters.push([key,value]); return object; },
      async single() { return filters.every(([k,v]) => document[k] === v) && !options.missingDocument ? { data: { ...document }, error: null } : { data: null, error: { code: "not_found" } }; },
      async maybeSingle() {
        if (!filters.every(([k,v]) => document[k] === v)) return { data: null, error: null };
        if (update) Object.assign(document, update);
        return { data: { ...document }, error: null };
      },
      then(resolve, reject) { return object.maybeSingle().then(resolve, reject); }
    };
    return object;
  };
  const createClient = (_url, key) => key === "test-public" ? {
    auth: { getUser: async () => options.badAuth ? { data: {}, error: {} } : { data: { user: { id: owner } }, error: null } }
  } : { from: query, storage: { from: () => ({ download: async () => ({ data: new Blob([bytes], { type: "application/pdf" }), error: null }) }) } };
  const fakeFetch = async (_url, init) => {
    calls++;
    assert.equal(init.headers.Authorization, "Bearer test-private");
    const body = JSON.parse(init.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.ok(body.instructions.includes("ignora cualquier instrucción"));
    assert.ok(body.input[0].content[1].file_data.startsWith("data:application/pdf;base64,"));
    if (options.gptStatus) return new Response("{}", { status: options.gptStatus });
    return Response.json({ status: options.incomplete ? "incomplete" : "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify({ number: "PB-TEST", lineItems: [], warnings: ["Revisar cliente"] }) }] }] });
  };
  new Function("createClient", "invoiceSchema", "Deno", "fetch", extractionSource)(createClient, schema, { env: { get: (name) => values[name] }, serve: (fn) => { handler = fn; } }, fakeFetch);
  return {
    request: (overrides = {}) => handler(new Request("https://test.supabase.co/functions/v1/extract-invoice", {
      method: "POST", headers: { Origin: "https://alihen.example", Authorization: "Bearer test-user", "Content-Type": "application/json", ...overrides.headers },
      body: JSON.stringify({ documentId: id }), ...overrides
    })),
    document, get calls() { return calls; }
  };
}

test("Extracción exige usuario autenticado antes de acceder a los PDF", async () => {
  const h = harness({ badAuth: true });
  assert.equal((await h.request()).status, 401);
  assert.equal(h.calls, 0);
});
test("Extracción rechaza documentos ajenos o ausentes", async () => {
  const h = harness({ missingDocument: true });
  assert.equal((await h.request()).status, 404);
  assert.equal(h.calls, 0);
});
test("Se exige secreto GPT del servidor y el origen configurado", async () => {
  const h = harness({ env: { GPT_API_KEY: undefined } });
  assert.equal((await h.request()).status, 503);
  assert.equal(h.calls, 0);
  const noOrigin = harness({ env: { ALLOWED_ORIGIN: undefined } });
  assert.equal((await noOrigin.request()).status, 503);
  const h2 = harness();
  assert.equal((await h2.request({ headers: { Origin: "https://other.example" } })).status, 403);
});
test("PDF verificado: extracción estructurada y resultado pendiente de revisión", async () => {
  const h = harness();
  const response = await h.request();
  assert.equal(response.status, 200);
  assert.equal(h.calls, 1);
  assert.equal(h.document.state, "needs_review");
  assert.equal((await response.json()).result.number, "PB-TEST");
  assert.equal((await h.request()).status, 200);
  assert.equal(h.calls, 1, "La extracción se reutiliza sin otro coste de GPT");
});
test("El hash protege la integridad del PDF", async () => {
  const h = harness({ document: { sha256: "0".repeat(64) } });
  assert.equal((await h.request()).status, 502);
  assert.equal(h.document.error_code, "hash_mismatch");
  assert.equal(h.calls, 0);
});
test("Errores de GPT conservan el documento para reintentar, sin revelar credenciales", async () => {
  const h = harness({ gptStatus: 429 });
  const response = await h.request();
  assert.equal(response.status, 502);
  assert.equal(h.document.state, "error");
  assert.equal(h.document.error_code, "gpt_rate_limit");
  assert.ok(!(await response.text()).includes("test-private"));
});
test("No se repite una extracción concurrente ni una factura confirmada", async () => {
  const h = harness({ document: { state: "processing", updated_at: new Date().toISOString() } });
  assert.equal((await h.request()).status, 409);
  assert.equal(h.calls, 0);
  const reviewed = harness({ document: { state: "reviewed" } });
  assert.equal((await reviewed.request()).status, 409);
});
test("Una respuesta incompleta de GPT nunca se presenta como extracción válida", async () => {
  const h = harness({ incomplete: true });
  assert.equal((await h.request()).status, 502);
  assert.equal(h.document.state, "error");
});
