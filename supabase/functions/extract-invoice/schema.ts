const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
export const invoiceSchema = {
  type: "object", additionalProperties: false,
  properties: {
    number: nullableString, issuerName: nullableString, issuerTaxId: nullableString,
    clientName: nullableString, clientTaxId: nullableString,
    issueDate: nullableString, dueDate: nullableString, currency: nullableString,
    subtotal: nullableNumber, taxAmount: nullableNumber, retentionAmount: nullableNumber,
    total: nullableNumber, notes: nullableString,
    lineItems: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { description: nullableString, qty: nullableNumber, unitPrice: nullableNumber },
      required: ["description", "qty", "unitPrice"] } },
    warnings: { type: "array", items: { type: "string" } }
  },
  required: ["number", "issuerName", "issuerTaxId", "clientName", "clientTaxId", "issueDate", "dueDate", "currency", "subtotal", "taxAmount", "retentionAmount", "total", "notes", "lineItems", "warnings"]
};
