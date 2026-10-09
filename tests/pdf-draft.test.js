import test from "node:test";
import assert from "node:assert/strict";
import { localDraft } from "../pdf-draft.js";

test("Vencimiento explícito y discrepancia con las condiciones del pie", () => {
  const draft = localDraft("PB-010\nFECHA  VENCIMIENTO  FORMA DE PAGO\n10 ago 2026  10 sept 2026  Transferencia\nBase imponible 80,00 €\nIVA 21% 16,80 €\nTotal 96,80 €\nPlazo máximo de pago: 15 días naturales");
  assert.equal(draft.number, "PB-010");
  assert.equal(draft.issueDate, "2026-08-10");
  assert.equal(draft.dueDate, "2026-09-10");
  assert.ok(draft.warnings.some((w) => w.includes("no coincide")));
  assert.equal(draft.subtotal, 80);
  assert.equal(draft.total, 96.8);
  assert.equal(draft.retentionAmount, null, "No da por confirmada una retención ausente");
});
test("No extrae fechas de conceptos ni calcula un vencimiento ausente", () => {
  const draft = localDraft("Servicios 01/08/2026\nPlazo máximo de pago: 15 días naturales");
  assert.equal(draft.issueDate, null);
  assert.equal(draft.dueDate, null);
});
test("Fechas numéricas y cantidades con separador de miles", () => {
  const draft = localDraft("PB-009\nFECHA VENCIMIENTO\n01/08/2026 16/08/2026\nBase imponible 1.522,14 €\nIVA 21% 319,65 €\nTotal 1.841,79 €");
  assert.equal(draft.issueDate, "2026-08-01");
  assert.equal(draft.dueDate, "2026-08-16");
  assert.equal(draft.total, 1841.79);
});
