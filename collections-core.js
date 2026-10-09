// Reglas compartidas por la interfaz, las pruebas y la extracción.
export const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
export const roundMoney = (value) => cents(value) / 100;
export function todayMadrid(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function normalizeCollection(invoice) {
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  // Los cobros históricos no tienen fecha conocida: no inventamos un pago.
  const openingPaid = invoice.openingPaid !== undefined ? Number(invoice.openingPaid) :
    invoice.status === "paid" && !payments.length ? Number(invoice.amount) : 0;
  return { ...invoice, amount: roundMoney(invoice.amount), payments: payments.map((p) => ({ ...p, amount: roundMoney(p.amount) })), openingPaid: roundMoney(openingPaid), cancelled: Boolean(invoice.cancelled || invoice.status === "cancelled") };
}
export function collection(invoice, today = todayMadrid()) {
  const normalized = normalizeCollection(invoice);
  const paidCents = cents(normalized.openingPaid) + normalized.payments.reduce((sum, p) => sum + cents(p.amount), 0);
  const remainingCents = Math.max(0, cents(invoice.amount) - paidCents);
  const paid = paidCents / 100;
  const balance = normalized.cancelled ? 0 : remainingCents / 100;
  const missingDueDate = !validDate(invoice.dueDate);
  const overdue = !normalized.cancelled && balance > 0 && !missingDueDate && invoice.dueDate < today;
  const daysLate = overdue ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${invoice.dueDate}T00:00:00Z`)) / 86400000) : 0;
  const status = normalized.cancelled ? "cancelled" : cents(invoice.amount) > 0 && balance === 0 ? "paid" : paid > 0 ? "partial" : "pending";
  return { paid, balance, status, overdue, daysLate, missingDueDate, displayStatus: overdue ? "overdue" : status };
}
export function addPayment(invoice, payment, today = todayMadrid()) {
  const info = collection(invoice, today);
  if (info.status === "cancelled") throw new Error("No se pueden registrar pagos en una factura anulada.");
  if (!Number.isFinite(Number(payment.amount)) || cents(payment.amount) <= 0) throw new Error("Introduce un importe mayor que cero.");
  if (cents(payment.amount) > cents(info.balance)) throw new Error("El pago supera el saldo pendiente.");
  if (!validDate(payment.date) || payment.date > today) throw new Error("Introduce una fecha de cobro válida, que no sea futura.");
  const normalized = normalizeCollection(invoice);
  if (normalized.payments.some((p) => p.id === payment.id)) throw new Error("Este pago ya está registrado.");
  return { ...normalized, status: "pending", payments: [...normalized.payments, { ...payment, amount: roundMoney(payment.amount) }] };
}
export function duplicateInvoice(invoices, candidate) {
  const canonical = (s) => String(s || "").trim().toUpperCase();
  return invoices.find((i) => i.id !== candidate.id &&
    (candidate.documentHash && i.documentHash === candidate.documentHash ||
     canonical(i.number) === canonical(candidate.number) && i.issuerId === candidate.issuerId));
}
export function validateExtracted(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["La extracción no devolvió una factura."];
  for (const [key, label] of [["number", "Número"], ["issuerName", "Emisor"], ["clientName", "Cliente"]]) {
    if (typeof data[key] !== "string" || !data[key].trim()) errors.push(`${label}: pendiente de completar.`);
  }
  for (const [key, label] of [["issueDate", "Emisión"], ["dueDate", "Vencimiento"]]) {
    if (!validDate(data[key])) errors.push(`${label}: introduce una fecha válida.`);
  }
  if (validDate(data.issueDate) && validDate(data.dueDate) && data.dueDate < data.issueDate) errors.push("El vencimiento no puede ser anterior a la emisión.");
  for (const [key, label] of [["subtotal", "Base imponible"], ["taxAmount", "Impuestos"], ["retentionAmount", "Retención"], ["total", "Total"]]) {
    if (typeof data[key] !== "number" || !Number.isFinite(data[key]) || data[key] < 0) errors.push(`${label}: introduce un importe válido.`);
  }
  if (data.total === 0) errors.push("El total debe ser mayor que cero.");
  if ([data.subtotal, data.taxAmount, data.retentionAmount, data.total].every((n) => typeof n === "number" && Number.isFinite(n)) &&
      Math.abs(cents(data.subtotal) + cents(data.taxAmount) - cents(data.retentionAmount) - cents(data.total)) > 2) {
    errors.push("La base más impuestos menos retención no coincide con el total.");
  }
  if (!/^[A-Z]{3}$/.test(data.currency || "")) errors.push("Indica la moneda con tres letras (por ejemplo, EUR).");
  if (Array.isArray(data.lineItems) && data.lineItems.length && data.lineItems.every((i) => typeof i.qty === "number" && typeof i.unitPrice === "number")) {
    if (data.lineItems.some((i) => i.qty < 0 || i.unitPrice < 0 || !Number.isFinite(i.qty) || !Number.isFinite(i.unitPrice))) errors.push("Los conceptos contienen cantidades o precios inválidos.");
    if (Math.abs(cents(data.lineItems.reduce((s, i) => s + i.qty * i.unitPrice, 0)) - cents(data.subtotal)) > 2) errors.push("Los conceptos no suman la base imponible. Revisa el detalle o indica descuentos en la base.");
  }
  return errors;
}
