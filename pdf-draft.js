export function localDraft(text) {
  const parseMoney = (s) => Number(s.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  const amount = (pattern) => {
    const match = text.match(pattern);
    return match ? parseMoney(match[1]) : null;
  };
  const lines = text.split("\n");
  const header = lines.findIndex((line) => /\bFECHA\b.*\bVENCIMIENTO\b/i.test(line));
  const dateRow = header >= 0 ? lines[header + 1] || "" : "";
  const months = { ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06", jul: "07", ago: "08", sep: "09", sept: "09", oct: "10", nov: "11", dic: "12" };
  const dates = [...dateRow.matchAll(/\b(\d{1,2})(?:[\/.-](\d{1,2})[\/.-]|\s+(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\.?\s+)(20\d{2})\b/gi)]
    .map((m) => `${m[4]}-${m[2] ? m[2].padStart(2, "0") : months[m[3].toLowerCase()]}-${m[1].padStart(2, "0")}`);
  const warnings = ["Lectura local, sin GPT: confirma cliente, emisor, fechas, retenciones e importes con el PDF."];
  const terms = text.match(/Plazo m[aá]ximo de pago:\s*(\d+)\s*d[ií]as naturales/i);
  if (terms && dates.length === 2 && (Date.parse(dates[1]) - Date.parse(dates[0])) / 86400000 !== Number(terms[1])) {
    warnings.push("El vencimiento escrito no coincide con el plazo de pago del pie del documento. Confirma cuál corresponde; se conserva la fecha escrita.");
  }
  // Solo prellenamos etiquetas inequívocas; nunca calculamos un vencimiento ausente.
  return {
    number: text.match(/\b(?:PB|FRA|FAC)[- ]\d+\b/i)?.[0] || null,
    issuerName: null, issuerTaxId: null, clientName: null, clientTaxId: null,
    issueDate: dates[0] || null, dueDate: dates[1] || null,
    currency: text.includes("€") ? "EUR" : null,
    subtotal: amount(/Base imponible\s+([\d.]+,\d{2})/i),
    taxAmount: amount(/IVA\s+\d+(?:[,.]\d+)?\s*%\s+([\d.]+,\d{2})/i),
    retentionAmount: amount(/(?:IRPF|Retenci[oó]n)\s+\d+(?:[,.]\d+)?\s*%\s+([\d.]+,\d{2})/i),
    total: amount(/^\s*Total\s+([\d.]+,\d{2})/im),
    lineItems: [], notes: null,
    warnings
  };
}
