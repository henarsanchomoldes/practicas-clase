import test from "node:test";
import assert from "node:assert/strict";
import { addPayment, collection, duplicateInvoice, normalizeCollection, todayMadrid, validateExtracted, validDate } from "../collections-core.js";

const invoice = { id: 1, issuerId: "ruecha", number: "PB-010", amount: 96.8, dueDate: "2026-10-09", status: "pending", openingPaid: 0, payments: [] };
test("Vence hoy: pendiente; mañana: vencida", () => {
  assert.equal(collection(invoice, "2026-10-09").overdue, false);
  assert.equal(collection(invoice, "2026-10-10").overdue, true);
  assert.equal(collection(invoice, "2026-10-10").daysLate, 1);
});
test("Fecha de negocio de Madrid, incluida la transición de día y horario de invierno", () => {
  assert.equal(todayMadrid(new Date("2026-10-09T22:30:00Z")), "2026-10-10");
  assert.equal(todayMadrid(new Date("2026-12-09T23:30:00Z")), "2026-12-10");
  assert.equal(validDate("2026-02-30"), false);
});
test("Una fecha ausente no inventa un vencimiento", () => {
  const state = collection({ ...invoice, dueDate: "" }, "2026-10-10");
  assert.equal(state.overdue, false);
  assert.equal(state.missingDueDate, true);
});
test("Pago parcial y vencimiento coexisten; el pago completo resuelve el vencimiento", () => {
  const partial = addPayment(invoice, { id: "a", date: "2026-10-09", amount: 50 }, "2026-10-10");
  assert.deepEqual([collection(partial, "2026-10-10").status, collection(partial, "2026-10-10").balance, collection(partial, "2026-10-10").overdue], ["partial", 46.8, true]);
  const paid = addPayment(partial, { id: "b", date: "2026-10-10", amount: 46.8 }, "2026-10-10");
  assert.equal(collection(paid, "2026-10-11").status, "paid");
  assert.equal(collection(paid, "2026-10-11").overdue, false);
});
test("Los centimos se suman sin dejar saldos residuales", () => {
  let i = { ...invoice, amount: 0.3 };
  i = addPayment(i, { id: "a", date: "2026-10-09", amount: 0.1 }, "2026-10-09");
  i = addPayment(i, { id: "b", date: "2026-10-09", amount: 0.2 }, "2026-10-09");
  assert.equal(collection(i).balance, 0);
});
test("Se rechazan pagos negativos, superiores al saldo, duplicados o con fechas futuras", () => {
  for (const p of [{ amount: -1, date: "2026-10-09" }, { amount: 100, date: "2026-10-09" }, { amount: 10, date: "2026-10-11" }, { amount: 10, date: "2026-02-30" }]) {
    assert.throws(() => addPayment(invoice, p, "2026-10-10"));
  }
  const i = addPayment(invoice, { id: "a", amount: 10, date: "2026-10-09" }, "2026-10-10");
  assert.throws(() => addPayment(i, { id: "a", amount: 10, date: "2026-10-09" }, "2026-10-10"));
});
test("Las facturas anuladas no generan alertas ni aceptan pagos", () => {
  const i = { ...invoice, cancelled: true };
  assert.equal(collection(i, "2026-10-10").overdue, false);
  assert.equal(collection(i, "2026-10-10").balance, 0);
  assert.throws(() => addPayment(i, { amount: 1, date: "2026-10-09" }));
});
test("Los cobros históricos se mantienen sin inventar fechas", () => {
  const i = normalizeCollection({ ...invoice, status: "paid", openingPaid: undefined });
  assert.equal(i.openingPaid, 96.8);
  assert.deepEqual(i.payments, []);
  assert.equal(collection(i).status, "paid");
});
test("Importes de la versión anterior se normalizan a céntimos antes de persistir", () => {
  const i = normalizeCollection({ ...invoice, amount: 1522.14 * 1.21 });
  assert.equal(i.amount, 1841.79);
  assert.equal(collection(addPayment(i, { id: "a", amount: 1841.79, date: "2026-10-09" }, "2026-10-09")).status, "paid");
});
test("Duplicado por PDF o número/emisor, permitiendo series de distintos emisores", () => {
  assert.equal(duplicateInvoice([invoice], { ...invoice, id: 2, number: " pb-010 " }), invoice);
  assert.equal(duplicateInvoice([invoice], { ...invoice, id: 2, issuerId: "other" }), undefined);
  assert.ok(duplicateInvoice([{ ...invoice, documentHash: "hash" }], { id: 2, number: "new", documentHash: "hash" }));
});
const extracted = { number: "PB-010", issuerName: "Emisor", clientName: "Cliente", issueDate: "2026-10-01", dueDate: "2026-10-16", currency: "EUR", subtotal: 80, taxAmount: 16.8, retentionAmount: 0, total: 96.8, lineItems: [{ description: "Diseño", qty: 1, unitPrice: 80 }] };
test("Importes de las tres facturas aportadas: base, IVA y total consistentes", () => {
  for (const [subtotal, taxAmount, total] of [[80,16.8,96.8],[1522.14,319.65,1841.79],[600,126,726]]) {
    assert.deepEqual(validateExtracted({ ...extracted, subtotal, taxAmount, total, lineItems: [] }), []);
  }
});
test("Revisión rechaza importes inconsistentes y campos ausentes", () => {
  assert.ok(validateExtracted({ ...extracted, total: 120 }).some((e) => e.includes("no coincide")));
  assert.ok(validateExtracted({ ...extracted, dueDate: null }).some((e) => e.includes("Vencimiento")));
  assert.ok(validateExtracted({ ...extracted, lineItems: [{ qty: 1, unitPrice: 70 }] }).some((e) => e.includes("conceptos")));
});
