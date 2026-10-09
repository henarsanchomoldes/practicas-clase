import { collection, normalizeCollection, todayMadrid, cents, roundMoney } from "./collections-core.js";
import { initializeCollections } from "./collections-ui.js";
let collectionsUI = null;
let storagePrefix = "alihen";
const invoiceMoney = (value, invoice) => new Intl.NumberFormat("es-ES", { style: "currency", currency: invoice.currency || "EUR", useGrouping: "always" }).format(value);
const collectionBadge = (invoice) => {
  const info = collection(invoice);
  return statusBadge(info.displayStatus) + (info.overdue && info.status === "partial" ? "<br><small>Pago parcial</small>" : "") + (info.missingDueDate && info.balance > 0 && !invoice.cancelled ? "<br><small>Falta vencimiento</small>" : "");
};
function persist(key, value) {
  try { localStorage.setItem(`${storagePrefix}-${key}`, JSON.stringify(value)); }
  catch { alert("No se pudo guardar la copia local. Exporta una copia y revisa el espacio del navegador."); }
  collectionsUI?.changed();
}
const money = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always"
});

const business = {
  brand: "AliHen",
  quoteBrand: "AliHen",
  invoiceIssuer: "Ruecha Asociados, S.L.",
  tagline: "gestión de presupuestos, facturas y pagos",
  fiscalName: "Ruecha Asociados, S.L.",
  taxId: "B85843332",
  address: "Plaza Tres Olivos 4, 28034 Madrid",
  province: "Madrid",
  country: "España",
  email: "ruecha@ruechaasociados.com",
  publicEmail: "henarsanchomoldes@gmail.com",
  phone: "659 797 808",
  publicPhone: "627 932 681",
  iban: "ES17 2100 5795 9602 0026 9031",
  bank: "CaixaBank",
  vat: 21,
  paymentTermsInvoice: 15,
  paymentTermsQuote: 30,
  quoteValidity: 30
};

const defaultInvoiceIssuers = [
  {
    id: "ruecha",
    label: "Ruecha",
    fiscalName: "Ruecha Asociados, S.L.",
    taxId: "B85843332",
    address: "Plaza Tres Olivos 4, 28034 Madrid",
    email: "ruecha@ruechaasociados.com",
    phone: "659 797 808",
    iban: "ES17 2100 5795 9602 0026 9031",
    bank: "CaixaBank",
    vat: 21,
    paymentTermsInvoice: 15,
    active: true,
    notes: "Emisor actual de facturas."
  },
  {
    id: "henar-autonoma",
    label: "Mis datos de autónoma",
    fiscalName: "",
    taxId: "",
    address: "",
    email: business.publicEmail,
    phone: business.publicPhone,
    iban: "",
    bank: "",
    vat: 21,
    paymentTermsInvoice: 15,
    active: false,
    notes: "Preparado para rellenar cuando te des de alta de autónoma."
  }
];

const documents = [
  { name: "Presupuesto NO.MAD 001 actualizado", type: "Presupuesto cliente", path: "Presupuesto NO.MAD 001.jpg" },
  { name: "Tarifario H_S JUN26", type: "Tarifario", path: "TARIFARIO/Tarifario H_S JUN26.pdf" },
  { name: "Plantilla FACTURAS", type: "Factura", path: "PLANTILLA FACTURAS/Plantilla FACTURAS.pdf" },
  { name: "Plantilla PRESUS", type: "Presupuesto", path: "PLANTILLAS PRESUPUESTOS/Plantilla PRESUS.pdf" },
  { name: "Formulario Alta Proveedor", type: "Datos fiscales", path: "DATOS FISCALES/Formulario Alta Proveedor.pdf" }
];

const defaultClients = [
  { id: 1, name: "LA CASETA", fiscalName: "LA CASETA", email: "admin@lacaseta.es", contact: "Producción", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 2, name: "NATUTERRA", fiscalName: "NATUTERRA", email: "facturacion@natuterra.es", contact: "Marketing", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 3, name: "NADA PRODUCTIONS", fiscalName: "NADA PRODUCTIONS", email: "hello@nadaproductions.es", contact: "Producción", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 4, name: "GRUPO SIM", fiscalName: "GRUPO SIM", email: "facturas@gruposim.es", contact: "Comunicación", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 5, name: "DENTSU", fiscalName: "DENTSU", email: "billing@dentsu.es", contact: "Cuentas", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 6, name: "NO.MAD", fiscalName: "NO.MAD", email: "studio@nomad.es", contact: "Estudio", contactRole: "", phone: "", taxId: "Pendiente", address: "Padre Damián 43", postalCode: "28036", city: "Madrid", province: "Madrid", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" },
  { id: 7, name: "CALVO DISTRIBUCIÓN", fiscalName: "CALVO DISTRIBUCIÓN", email: "administracion@calvo.es", contact: "Administración", contactRole: "", phone: "", taxId: "Pendiente", address: "", postalCode: "", city: "", province: "", country: "España", paymentTerms: 30, paymentMethod: "Transferencia", notes: "" }
];

let clients = loadClients();
let invoiceIssuers = loadInvoiceIssuers();

const rates = [
  { id: 1, category: "Cambios de creatividad", name: "Flyer / Díptico A5 o Americano / Flyer A4", unit: "unidad", price: 70, description: "Revisión mayor o nuevo concepto." },
  { id: 2, category: "Cambios de creatividad", name: "Díptico A4", unit: "unidad", price: 75, description: "Revisión mayor o nuevo concepto." },
  { id: 3, category: "Cambios de creatividad", name: "Poster A4 / A3 / A2", unit: "unidad", price: 90, description: "Revisión mayor o nuevo concepto." },
  { id: 4, category: "Cambios de creatividad", name: "Grandes formatos", unit: "unidad", price: 100, description: "Mupi, valla, lona o roll up." },
  { id: 5, category: "Cambios de creatividad", name: "Folleto multipágina", unit: "página", price: 20, description: "Mínimo 8 páginas." },
  { id: 6, category: "Artes finales", name: "Arte final pequeño/mediano", unit: "unidad", price: 50, description: "A5-A2, flyers y dípticos." },
  { id: 7, category: "Artes finales", name: "Arte final grandes formatos", unit: "unidad", price: 80, description: "Mupi, valla, lona o roll up." },
  { id: 8, category: "Artes finales", name: "Arte final folleto multipágina", unit: "página", price: 20, description: "Preparación por página." },
  { id: 9, category: "Artes finales", name: "Arte final digital", unit: "unidad", price: 35, description: "Entrega digital final." },
  { id: 10, category: "Artes finales", name: "Cambios en arte final", unit: "unidad", price: 20, description: "Ajustes sobre arte final existente." },
  { id: 11, category: "Adaptaciones", name: "A5 / Americano / A4 / Díptico", unit: "unidad", price: 90, description: "Adaptar diseño aprobado a nuevo formato." },
  { id: 12, category: "Adaptaciones", name: "A3 / A2 / Poster", unit: "unidad", price: 110, description: "Adaptar diseño aprobado a nuevo formato." },
  { id: 13, category: "Adaptaciones", name: "Grandes formatos", unit: "unidad", price: 150, description: "Mupi, valla, lona o roll up." },
  { id: 14, category: "Adaptaciones", name: "Folleto multipágina base", unit: "base", price: 120, description: "Base de adaptación; sumar páginas aparte." },
  { id: 15, category: "Adaptaciones", name: "Folleto multipágina página adicional", unit: "página", price: 10, description: "Página adicional en folleto adaptado." },
  { id: 16, category: "Adaptaciones", name: "Adaptación digital", unit: "unidad", price: 45, description: "Formato digital aprobado." },
  { id: 17, category: "Adaptaciones", name: "Traducciones", unit: "unidad", price: 35, description: "Adaptación de textos traducidos." },
  { id: 18, category: "Retoque de imágenes", name: "Retoque básico", unit: "unidad", price: 30, description: "Color, limpieza y recorte." },
  { id: 19, category: "Retoque de imágenes", name: "Retoque avanzado", unit: "unidad", price: 60, description: "Montaje o eliminación de objetos." },
  { id: 20, category: "Soporte", name: "Soporte por horas", unit: "hora", price: 70, description: "Soporte general por hora." }
];

const defaultQuotes = [
  {
    id: 4,
    number: "P-2026-004",
    clientId: 6,
    serviceId: 6,
    qty: 1,
    discount: 0,
    status: "accepted",
    notes: "Schweppes. Presupuesto NO.MAD 001 actualizado.",
    lineItems: [
      { category: "Arte final", description: "Ventana lineal Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Vinilos suelo Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Vinilos suelo troquelado Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Monopostes Vinilo Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Mupi Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Columna Cast", qty: 1, unitPrice: 80 },
      { category: "Arte final", description: "Tranvia Cast", qty: 2, unitPrice: 160 },
      { category: "Adaptaciones", description: "Vinilos suelo Cast", qty: 1, unitPrice: 40 },
      { category: "Adaptaciones", description: "Vinilos suelo troquelado Cast", qty: 1, unitPrice: 40 },
      { category: "Adaptaciones", description: "Ventana lineal Cast", qty: 3, unitPrice: 40 },
      { category: "Adaptaciones", description: "Mupi Cast", qty: 1, unitPrice: 40 },
      { category: "Traducciones", description: "Monopostes Vinilo Catalán", qty: 1, unitPrice: 35 },
      { category: "Traducciones", description: "Kioskos Bcn", qty: 1, unitPrice: 35 },
      { category: "Traducciones", description: "Mupi Catalan", qty: 2, unitPrice: 35 },
      { category: "Traducciones", description: "Vinilos suelo", qty: 3, unitPrice: 35 },
      { category: "Traducciones", description: "Ventana lineal Cat", qty: 1, unitPrice: 35 }
    ]
  },
  { id: 10, number: "DENTSU-001", clientId: 5, serviceId: 7, qty: 1, discount: 0, status: "sent", notes: "Presupuesto DENTSU 001.", lineItems: [{ category: "Presupuesto", description: "Presupuesto DENTSU 001", qty: 1, unitPrice: 5440 }] },
  { id: 11, number: "DENTSU-HORAS-001", clientId: 5, serviceId: 20, qty: 1, discount: 0, status: "sent", notes: "Presupuesto DENTSU x horas 001.", lineItems: [{ category: "Horas", description: "Horas (4 días)", qty: 32, unitPrice: 70 }] },
  { id: 12, number: "GRUPO-SIM-001", clientId: 4, serviceId: 18, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto GRUPO SIM 001.", lineItems: [{ category: "Presupuesto", description: "Trasera, retoque imagen y plataforma", qty: 1, unitPrice: 260 }] },
  { id: 13, number: "LA-CASETA-001", clientId: 1, serviceId: 20, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto LA CASETA 001.", lineItems: [{ category: "Presupuesto", description: "Servicios correspondientes al periodo del 1 al 30 de junio", qty: 1, unitPrice: 1500 }] },
  { id: 14, number: "NADA-001", clientId: 3, serviceId: 7, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto NADA 001.", lineItems: [{ category: "Presupuesto", description: "Artes finales NADA Productions", qty: 1, unitPrice: 1660 }] },
  { id: 15, number: "NATUTERRA-001", clientId: 2, serviceId: 7, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto NATUTERRA 001.", lineItems: [{ category: "Presupuesto", description: "Realización arte final y adaptación digital", qty: 1, unitPrice: 275 }] },
  { id: 16, number: "NATUTERRA-002", clientId: 2, serviceId: 7, qty: 1, discount: 0, status: "sent", notes: "Presupuesto NATUTERRA 002.", lineItems: [{ category: "Presupuesto", description: "Diseño, arte final y transporte", qty: 1, unitPrice: 372 }] },
  { id: 17, number: "NATUTERRA-003", clientId: 2, serviceId: 7, qty: 1, discount: 0, status: "sent", notes: "Presupuesto NATUTERRA 003.", lineItems: [{ category: "Presupuesto", description: "Artes finales, traducciones y adaptaciones", qty: 1, unitPrice: 1815 }] },
  { id: 18, number: "CALVO-004", clientId: 7, serviceId: 1, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto CALVO 004.", lineItems: [{ category: "Presupuesto", description: "Sales folder A5", qty: 1, unitPrice: 120 }] },
  { id: 19, number: "CALVO-005", clientId: 7, serviceId: 1, qty: 1, discount: 0, status: "accepted", notes: "Presupuesto CALVO 005.", lineItems: [{ category: "Presupuesto", description: "Cambios creatividad, artes finales y adaptaciones", qty: 1, unitPrice: 1340 }] },
  { id: 20, number: "CALVO-006", clientId: 7, serviceId: 7, qty: 1, discount: 0, status: "sent", notes: "Presupuesto CALVO 006.", lineItems: [{ category: "Presupuesto", description: "Arte final, cambios y adaptación digital", qty: 1, unitPrice: 175 }] }
];

const defaultInvoices = [
  { id: 10, number: "PB-008", clientId: 1, issueDate: "2026-07-28", dueDate: "2026-08-12", amount: 0, status: "pending", notes: "LA CASETA · factura manual pendiente de completar", lineItems: [] },
  { id: 8, number: "PB-007", clientId: 6, issueDate: "2026-07-14", dueDate: "2026-07-29", amount: 1597.2, status: "pending", sourceQuote: "P-2026-004", notes: "Schweppes · Presupuesto NO.MAD 001 actualizado" },
  { id: 1, number: "PB-001", clientId: 7, issueDate: "2026-06-03", dueDate: "2026-06-18", amount: 145.2, status: "paid", sourceQuote: "CALVO-004", notes: "Calvo Distribución · Presupuesto 004" },
  { id: 2, number: "PB-002", clientId: 7, issueDate: "2026-06-12", dueDate: "2026-06-27", amount: 1621.4, status: "paid", sourceQuote: "CALVO-005", notes: "Calvo Distribución · Presupuesto 005" },
  { id: 3, number: "PB-004", clientId: 1, issueDate: "2026-06-20", dueDate: "2026-07-05", amount: 819.68, status: "paid", sourceQuote: "LA-CASETA-001", notes: "LA CASETA · Presupuesto 001" },
  { id: 4, number: "PB-005", clientId: 1, issueDate: "2026-07-03", dueDate: "2026-07-18", amount: 1815, status: "pending", sourceQuote: "LA-CASETA-001", notes: "LA CASETA · periodo 1 al 30 de junio" },
  { id: 5, number: "PB-006", clientId: 2, issueDate: "2026-07-04", dueDate: "2026-07-19", amount: 332.75, status: "pending", sourceQuote: "NATUTERRA-001", notes: "NATUTERRA · Presupuesto 001" },
  { id: 6, number: "PB-003", clientId: 3, issueDate: "2026-06-24", dueDate: "2026-07-09", amount: 2008.6, status: "overdue", sourceQuote: "NADA-001", notes: "NADA Productions · Presupuesto 001" },
  { id: 7, number: "FRA-135", clientId: 4, issueDate: "2026-04-05", dueDate: "2026-04-20", amount: 314.6, status: "paid", sourceQuote: "GRUPO-SIM-001", notes: "GRUPO SIM · Factura 135" },
  { id: 9, number: "FRA-134", clientId: 7, issueDate: "2026-03-13", dueDate: "2026-03-28", amount: 332.75, status: "paid", notes: "CALVO DISTRIBUCIÓN · Factura 134" }
];

let invoices = loadInvoices();
let quotes = loadQuotes();

const views = {
  dashboard: "Panel",
  clients: "Clientes",
  rates: "Tarifario",
  quotes: "Presupuestos",
  invoices: "Facturas",
  "new-invoice": "Factura nueva",
  "fee-invoice": "Factura con FEE",
  payments: "Cobros",
  business: "Empresa"
};

function clientName(id) {
  return clients.find((client) => client.id === id)?.name || "Sin cliente";
}

function clientById(id) {
  return clients.find((client) => client.id === id);
}

function loadClients() {
  try {
    const storedClients = JSON.parse(localStorage.getItem("alihen-clients") || "null");
    const sourceClients = Array.isArray(storedClients) ? storedClients : defaultClients;
    return sourceClients.map(normalizeClient);
  } catch {
    return defaultClients.map(normalizeClient);
  }
}

function saveClients() {
  persist("clients", clients);
}

function loadInvoices() {
  try {
    const storedInvoices = JSON.parse(localStorage.getItem("alihen-invoices") || "null");
    if (!Array.isArray(storedInvoices)) return defaultInvoices.map(normalizeInvoice);
    return storedInvoices.map(normalizeInvoice);
  } catch {
    return defaultInvoices.map(normalizeInvoice);
  }
}

function saveInvoices() {
  invoices = invoices.map(normalizeInvoice);
  persist("invoices", invoices);
}

function polishSpanishText(value) {
  return String(value || "")
    .replace(/\bEspana\b/g, "España")
    .replace(/\bProduccion\b/g, "Producción")
    .replace(/\bComunicacion\b/g, "Comunicación")
    .replace(/\bAdministracion\b/g, "Administración")
    .replace(/\bDistribucion\b/g, "Distribución")
    .replace(/\bautonoma\b/g, "autónoma")
    .replace(/\bdias habiles\b/g, "días hábiles")
    .replace(/\bdias naturales\b/g, "días naturales");
}

function normalizeInvoice(invoice) {
  return {
    ...normalizeCollection(invoice),
    currency: invoice.currency || "EUR",
    issuerId: invoice.issuerId || "ruecha"
  };
}

function normalizeInvoiceIssuer(issuer) {
  return {
    id: issuer.id || `issuer-${Date.now()}`,
    label: polishSpanishText(issuer.label || issuer.fiscalName || "Emisor"),
    fiscalName: polishSpanishText(issuer.fiscalName || ""),
    taxId: issuer.taxId || "",
    address: issuer.address || "",
    email: issuer.email || "",
    phone: issuer.phone || "",
    iban: issuer.iban || "",
    bank: issuer.bank || "",
    vat: issuer.vat !== undefined && Number.isFinite(Number(issuer.vat)) ? Number(issuer.vat) : business.vat,
    paymentTermsInvoice: Number(issuer.paymentTermsInvoice) || business.paymentTermsInvoice,
    active: Boolean(issuer.active),
    notes: polishSpanishText(issuer.notes || "")
  };
}

function loadInvoiceIssuers() {
  try {
    const storedIssuers = JSON.parse(localStorage.getItem("alihen-invoice-issuers") || "null");
    if (!Array.isArray(storedIssuers)) return defaultInvoiceIssuers.map(normalizeInvoiceIssuer);
    const storedIds = new Set(storedIssuers.map((issuer) => issuer.id));
    const missingDefaults = defaultInvoiceIssuers.filter((issuer) => !storedIds.has(issuer.id));
    return [...missingDefaults, ...storedIssuers].map(normalizeInvoiceIssuer);
  } catch {
    return defaultInvoiceIssuers.map(normalizeInvoiceIssuer);
  }
}

function saveInvoiceIssuers() {
  persist("invoice-issuers", invoiceIssuers);
}

function invoiceIssuerById(id) {
  return invoiceIssuers.find((issuer) => issuer.id === id) || invoiceIssuers.find((issuer) => issuer.id === "ruecha") || defaultInvoiceIssuers[0];
}

function currentInvoiceIssuer() {
  return invoiceIssuers.find((issuer) => issuer.active) || invoiceIssuers[0] || defaultInvoiceIssuers[0];
}

function sanitizeQuoteForStorage(quote) {
  const { fileUrl, ...storedQuote } = quote;
  return storedQuote;
}

function loadQuotes() {
  try {
    const storedQuotes = JSON.parse(localStorage.getItem("alihen-quotes") || "null");
    if (!Array.isArray(storedQuotes)) return defaultQuotes;
    return storedQuotes.map((quote) => ({ ...quote, fileUrl: quote.fileUrl || "" }));
  } catch {
    return defaultQuotes;
  }
}

function saveQuotes() {
  try {
    localStorage.setItem(`${storagePrefix}-quotes`, JSON.stringify(quotes.map(sanitizeQuoteForStorage)));
    collectionsUI?.changed();
    return true;
  } catch {
    alert("No he podido guardar el archivo del presupuesto. Puede que pese demasiado para esta versión local. Exporta una copia antes de seguir para no perder datos.");
    return false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlobUrl(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "application/octet-stream";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function openQuoteFile(quote) {
  const fileSource = quote.fileData || quote.fileUrl;
  if (!fileSource) return false;
  const viewerSource = fileSource.startsWith("data:") ? dataUrlToBlobUrl(fileSource) : fileSource;

  const fileWindow = window.open("", "_blank");
  if (!fileWindow) {
    window.open(viewerSource, "_blank");
    return true;
  }

  if (quote.fileType?.startsWith("image/")) {
    fileWindow.document.write(`
      <title>${escapeHtml(quote.fileName || quote.number)}</title>
      <style>body{margin:0;background:#f5f2ed;display:grid;place-items:center;min-height:100vh}img{max-width:100%;height:auto;box-shadow:0 20px 60px rgba(0,0,0,.16)}</style>
      <img src="${viewerSource}" alt="${escapeHtml(quote.fileName || quote.number)}" />
    `);
    fileWindow.document.close();
  } else {
    fileWindow.document.write(`
      <title>${escapeHtml(quote.fileName || quote.number)}</title>
      <style>
        body{margin:0;background:#f5f2ed;font-family:Arial,sans-serif}
        header{align-items:center;background:#fff;border-bottom:1px solid #d9e1df;display:flex;gap:12px;justify-content:space-between;padding:12px 16px}
        strong{color:#202428}
        a{background:#238579;border-radius:8px;color:#fff;font-weight:700;padding:10px 14px;text-decoration:none}
        iframe{border:0;height:calc(100vh - 65px);width:100%}
      </style>
      <header><strong>${escapeHtml(quote.fileName || quote.number)}</strong><a href="${viewerSource}" target="_blank" rel="noreferrer">Abrir PDF</a></header>
      <iframe src="${viewerSource}"></iframe>
    `);
    fileWindow.document.close();
  }

  return true;
}

function exportBackup() {
  const backup = {
    app: business.brand,
    version: 1,
    exportedAt: new Date().toISOString(),
    clients,
    invoices,
    quotes: quotes.map(sanitizeQuoteForStorage),
    invoiceIssuers
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `alihen-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  try {
    const backup = JSON.parse(await file.text());
    const importedClients = Array.isArray(backup.clients) ? backup.clients.map(normalizeClient) : null;
    const importedInvoices = Array.isArray(backup.invoices) ? backup.invoices.map(normalizeInvoice) : null;
    const importedQuotes = Array.isArray(backup.quotes) ? backup.quotes.map((quote) => ({ ...quote, fileUrl: "" })) : null;
    const importedIssuers = Array.isArray(backup.invoiceIssuers) ? backup.invoiceIssuers.map(normalizeInvoiceIssuer) : null;

    if (!importedClients && !importedInvoices && !importedQuotes && !importedIssuers) {
      alert("No he encontrado clientes, facturas o presupuestos en esta copia.");
      return;
    }

    if (!confirm("Importar esta copia sustituirá los datos actuales de la app. Antes de seguir, exporta una copia si quieres conservarlos.")) return;

    if (importedClients) {
      clients = importedClients;
      saveClients();
    }
    if (importedInvoices) {
      invoices = importedInvoices;
      saveInvoices();
    }
    if (importedQuotes) {
      quotes = importedQuotes;
      saveQuotes();
    }
    if (importedIssuers) {
      invoiceIssuers = importedIssuers;
      saveInvoiceIssuers();
    }

    renderAll();
    resetClientForm();
    resetManualInvoiceForm();
    resetSimpleInvoiceForm();
    alert("Copia importada. Ya tienes los datos cargados en la app.");
  } catch {
    alert("No he podido importar la copia. Revisa que sea un archivo .json exportado desde AliHen.");
  }
}

function normalizeClient(client) {
  return {
    id: client.id,
    name: client.name || "",
    fiscalName: client.fiscalName || client.name || "",
    taxId: client.taxId || "",
    contact: polishSpanishText(client.contact || ""),
    contactRole: client.contactRole || "",
    phone: client.phone || "",
    email: client.email || "",
    address: polishSpanishText(client.address || ""),
    postalCode: client.postalCode || "",
    city: client.city || "",
    province: polishSpanishText(client.province || ""),
    country: polishSpanishText(client.country || "España"),
    paymentTerms: client.paymentTerms || business.paymentTermsQuote,
    paymentMethod: client.paymentMethod || "Transferencia",
    notes: polishSpanishText(client.notes || "")
  };
}

function clientFullAddress(client) {
  return [client.address, client.postalCode, client.city, client.province, client.country].filter(Boolean).join(", ");
}

function rateById(id) {
  return rates.find((rate) => rate.id === id);
}

function quoteAmount(quote) {
  if (typeof quote.manualAmount === "number") return quote.manualAmount;
  return quoteSubtotal(quote);
}

function quoteTotalWithVat(quote) {
  if (typeof quote.manualAmount === "number") return quote.manualAmount * (1 + business.vat / 100);
  if (quote.lineItems?.length) {
    const subtotal = quote.lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    return subtotal * (1 + business.vat / 100);
  }

  const rate = rateById(quote.serviceId);
  const subtotal = (rate?.price || 0) * quote.qty;
  const discounted = subtotal - subtotal * (quote.discount / 100);
  return discounted * (1 + business.vat / 100);
}

function quoteSubtotal(quote) {
  if (typeof quote.manualAmount === "number") return quote.manualAmount;
  if (quote.lineItems?.length) {
    return quote.lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  }

  const rate = rateById(quote.serviceId);
  const subtotal = (rate?.price || 0) * quote.qty;
  return subtotal - subtotal * (quote.discount / 100);
}

function quoteSummary(quote) {
  if (quote.lineItems?.length) {
    return `${quote.lineItems.length} conceptos · Base ${money.format(quoteSubtotal(quote))}`;
  }

  return `${rateById(quote.serviceId)?.name} · Base ${money.format(quoteSubtotal(quote))}`;
}

function quoteLineItems(quote) {
  if (typeof quote.manualAmount === "number") {
    return [{
      category: "Presupuesto",
      description: quote.notes || quote.fileName || quote.number,
      qty: 1,
      unitPrice: quote.manualAmount
    }];
  }

  if (quote.lineItems?.length) return quote.lineItems;

  const rate = rateById(quote.serviceId);
  return [{
    category: rate?.category || "Servicio",
    description: rate?.name || quote.notes || "Servicio",
    qty: quote.qty,
    unitPrice: rate?.price || 0
  }];
}

function invoiceForQuote(quoteNumber) {
  return invoices.find((invoice) => invoice.sourceQuote === quoteNumber);
}

function deleteInvoice(invoiceId) {
  const invoice = invoices.find((item) => item.id === Number(invoiceId));
  if (!invoice) return;
  if (collection(invoice).paid > 0 || invoice.documentId) { alert("Conserva el historial de cobros. Usa la anulación en lugar de eliminar."); return; }

  if (confirm(`¿Eliminar la factura ${escapeHtml(invoice.number)}?`)) {
    invoices = invoices.filter((item) => item.id !== invoice.id);
    saveInvoices();
    renderAll();
  }
}

function deleteQuote(quoteId) {
  const quote = quotes.find((item) => item.id === Number(quoteId));
  if (!quote) return;

  const linkedInvoice = invoiceForQuote(quote.number);
  const relationWarning = linkedInvoice ? ` Tiene la factura ${escapeHtml(linkedInvoice.number)} vinculada.` : "";

  if (confirm(`¿Eliminar el presupuesto ${escapeHtml(quote.number)}?${relationWarning}`)) {
    quotes = quotes.filter((item) => item.id !== quote.id);
    saveQuotes();
    renderAll();
  }
}

function quoteForInvoice(invoice) {
  return quotes.find((quote) => quote.number === invoice.sourceQuote);
}

function invoiceSubtotal(invoice) {
  if (invoice.lineItems?.length) {
    return invoice.lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  }

  const linkedQuote = quoteForInvoice(invoice);
  const issuer = invoiceIssuerById(invoice.issuerId);
  if (linkedQuote && Math.abs(quoteAmount(linkedQuote) * (1 + issuer.vat / 100) - invoice.amount) < 0.02) {
    return quoteSubtotal(linkedQuote);
  }

  return invoice.amount / (1 + business.vat / 100);
}

function invoiceLineItems(invoice) {
  if (invoice.lineItems?.length) return invoice.lineItems;

  const linkedQuote = quoteForInvoice(invoice);
  const issuer = invoiceIssuerById(invoice.issuerId);
  if (linkedQuote && Math.abs(quoteAmount(linkedQuote) * (1 + issuer.vat / 100) - invoice.amount) < 0.02) {
    return quoteLineItems(linkedQuote);
  }

  return [{
    category: "Servicio",
    description: invoice.notes || `Factura ${escapeHtml(invoice.number)}`,
    qty: 1,
    unitPrice: invoiceSubtotal(invoice)
  }];
}

function nextInvoiceNumber() {
  const next = invoices.reduce((max, invoice) => {
    const match = invoice.number.match(/^PB-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  return `PB-${String(next).padStart(3, "0")}`;
}

function isoDate(date) {
  return todayMadrid(date);
}

function isoMonth(date) {
  return date.toISOString().slice(0, 7);
}

function dateFromMonth(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(dateFromMonth(value));
}

function parseDisplayDate(value = "") {
  const months = {
    ene: 0,
    feb: 1,
    mar: 2,
    abr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    sept: 8,
    sep: 8,
    oct: 9,
    nov: 10,
    dic: 11
  };
  const match = String(value).match(/(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})/i);
  if (!match) return "";
  const monthKey = match[2].toLowerCase().replace(".", "");
  if (!(monthKey in months)) return "";
  return isoDate(new Date(Number(match[3]), months[monthKey], Number(match[1])));
}

function businessDaysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let total = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const weekDay = new Date(year, month, day).getDay();
    if (weekDay !== 0 && weekDay !== 6) total += 1;
  }

  return total;
}

function feeDescriptionParts(description = "") {
  const value = String(description || "");
  const suffixPattern = / · ([a-zA-Z]+ de \d{4}) · ([\d.,]+)\/([\d.,]+) d[ií]as (?:laborables|habiles|hábiles)/g;
  const matches = [...value.matchAll(suffixPattern)];
  if (!matches.length) {
    return { base: value.trim() || "Fee mensual", month: "", workDays: "", monthDays: "" };
  }

  const firstMatch = matches[0];
  return {
    base: value.replace(/( · [a-zA-Z]+ de \d{4} · [\d.,]+\/[\d.,]+ d[ií]as (?:laborables|habiles|hábiles))+$/g, "").trim() || "Fee mensual",
    month: firstMatch[1],
    workDays: firstMatch[2].replace(",", "."),
    monthDays: firstMatch[3].replace(",", ".")
  };
}

function cleanInvoiceLineDescription(item) {
  if (item.category !== "Fee mensual") return item.description;
  const parts = feeDescriptionParts(item.description);
  if (!parts.month || !parts.workDays || !parts.monthDays) return parts.base;
  return `${parts.base} · ${parts.month} · ${parts.workDays}/${parts.monthDays} días hábiles`;
}

function updateBusinessDaysFromBillingMonth() {
  const billingMonth = document.querySelector("#invoice-billing-month").value;
  if (!billingMonth) return;
  document.querySelector("#invoice-month-days").value = businessDaysInMonth(dateFromMonth(billingMonth));
  updateFeeAmount();
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addExtraLine(value = {}) {
  const line = document.createElement("div");
  line.className = "extra-line";
  line.innerHTML = `
    <label>
      Día
      <input class="extra-date" type="date" value="${value.date || ""}" />
    </label>
    <label>
      Concepto
      <input class="extra-description" value="${value.description || "Horas extra"}" />
    </label>
    <label>
      Horas
      <input class="extra-hours" min="0" step="0.25" type="number" value="${value.hours || 0}" />
    </label>
    <label>
      Precio/hora
      <input class="extra-rate" min="0" step="0.01" type="number" value="${value.rate || 70}" />
    </label>
    <button class="table-action danger-action remove-extra-line" type="button">Quitar</button>
  `;
  document.querySelector("#extra-lines").appendChild(line);
}

function parseExtraItem(item) {
  const cleanDescription = item.description?.replace(/ · \d{1,2} [a-záéíóúñ.]+ \d{4}$/i, "") || "Horas extra";
  const dateMatch = item.description?.match(/ · (\d{1,2} [a-záéíóúñ.]+ \d{4})$/i);
  return {
    description: cleanDescription,
    hours: item.qty || 0,
    rate: item.unitPrice || 70,
    date: item.date || parseDisplayDate(dateMatch?.[1])
  };
}

function extraLineItems() {
  return [...document.querySelectorAll(".extra-line")].map((line) => {
    const date = line.querySelector(".extra-date").value;
    const description = line.querySelector(".extra-description").value.trim() || "Horas extra";
    const hours = Number(line.querySelector(".extra-hours").value) || 0;
    const rate = Number(line.querySelector(".extra-rate").value) || 0;
    return {
      category: "Horas extra",
      description: date ? `${description} · ${formatDate(date)}` : description,
      date,
      qty: hours,
      unitPrice: rate
    };
  }).filter((item) => item.qty > 0 && item.unitPrice > 0);
}

function resetManualInvoiceForm() {
  const today = new Date();
  const issuer = currentInvoiceIssuer();
  document.querySelector("#manual-invoice-form").reset();
  document.querySelector("#editing-invoice-id").value = "";
  document.querySelector("#manual-invoice-title").textContent = "Nueva factura con FEE";
  document.querySelector("#save-invoice-button").textContent = "Crear factura";
  document.querySelector("#invoice-number").value = nextInvoiceNumber();
  document.querySelector("#invoice-issue-date").value = isoDate(today);
  document.querySelector("#invoice-due-date").value = isoDate(addDays(today, issuer.paymentTermsInvoice));
  document.querySelector("#invoice-client").value = clients.find((client) => client.name === "LA CASETA")?.id || clients[0]?.id || "";
  document.querySelector("#invoice-issuer").value = issuer.id;
  document.querySelector("#invoice-billing-month").value = isoMonth(today);
  document.querySelector("#invoice-monthly-fee").value = 1500;
  document.querySelector("#invoice-month-days").value = businessDaysInMonth(today);
  document.querySelector("#invoice-work-days").value = 0;
  document.querySelector("#extra-lines").innerHTML = "";
  addExtraLine();
  updateFeeAmount();
}

function editInvoice(invoiceId) {
  const invoice = invoices.find((item) => item.id === Number(invoiceId));
  if (!invoice) return;
  if (invoice.invoiceType === "imported") { changeView("invoices"); collectionsUI.editImported(invoice); return; }

  const items = invoiceLineItems(invoice);
  const isFee = invoice.invoiceType === "fee" || (!invoice.invoiceType && items.some((item) => item.category === "Fee mensual" || item.category === "Horas extra"));
  if (!isFee) {
    editSimpleInvoice(invoice);
    return;
  }
  changeView("fee-invoice");
  const feeItem = items.find((item) => item.category === "Fee mensual") || items[0];
  const extraItems = items.filter((item) => item.category === "Horas extra");

  document.querySelector("#editing-invoice-id").value = invoice.id;
  document.querySelector("#manual-invoice-title").textContent = `Editando ${escapeHtml(invoice.number)}`;
  document.querySelector("#save-invoice-button").textContent = "Guardar cambios";
  document.querySelector("#invoice-client").value = invoice.clientId;
  document.querySelector("#invoice-issuer").value = invoice.issuerId || "ruecha";
  document.querySelector("#invoice-number").value = invoice.number;
  document.querySelector("#invoice-issue-date").value = invoice.issueDate;
  document.querySelector("#invoice-due-date").value = invoice.dueDate;
  document.querySelector("#invoice-status").value = invoice.status;
  document.querySelector("#invoice-notes").value = invoice.notes || "";
  document.querySelector("#invoice-billing-month").value = invoice.billingMonth || invoice.issueDate?.slice(0, 7) || isoMonth(new Date());
  const feeParts = feeDescriptionParts(feeItem?.description);
  document.querySelector("#invoice-fee-description").value = feeParts.base;
  document.querySelector("#invoice-fee-amount").value = feeItem?.unitPrice?.toFixed?.(2) || 0;
  document.querySelector("#invoice-monthly-fee").value = feeItem?.monthlyFee || feeItem?.unitPrice?.toFixed?.(2) || 1500;
  document.querySelector("#invoice-month-days").value = feeItem?.monthDays || feeParts.monthDays || businessDaysInMonth(dateFromMonth(document.querySelector("#invoice-billing-month").value));
  document.querySelector("#invoice-work-days").value = feeItem?.workDays || feeParts.workDays || feeParts.monthDays || 0;
  document.querySelector("#extra-lines").innerHTML = "";

  if (extraItems.length) {
    extraItems.forEach((item) => addExtraLine(parseExtraItem(item)));
  } else {
    addExtraLine();
  }

  document.querySelector("#manual-invoice-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function addSimpleLine(item = {}) {
  const line = document.createElement("section");
  line.className = "simple-work-line extra-hours-box";
  line.innerHTML = `
    <label>Trabajo<input class="simple-work" required placeholder="Por ejemplo: Diseño de cartel" value="${escapeHtml(item.category || "")}" /></label>
    <label>Descripción del trabajo<textarea class="simple-description" rows="3" placeholder="Detalles del trabajo realizado">${escapeHtml(item.description || "")}</textarea></label>
    <div class="form-row">
      <label>Importe (€, antes de IVA)<input class="simple-amount" type="number" min="0.01" step="0.01" required value="${item.unitPrice !== undefined ? (item.qty || 1) * item.unitPrice : ""}" /></label>
      <button class="ghost-button remove-simple-line" type="button">Quitar trabajo</button>
    </div>`;
  // Retain original quantities and metadata when editing an existing invoice.
  line.originalItem = item;
  document.querySelector("#simple-lines").appendChild(line);
  updateSimpleTotal();
}

function simpleLineItems() {
  return [...document.querySelectorAll(".simple-work-line")].map((line) => {
    const original = line.originalItem || {};
    const total = Number(line.querySelector(".simple-amount").value);
    const unchangedAmount = original.qty > 0 && Math.abs(original.qty * original.unitPrice - total) < 0.000001;
    return {
      ...original,
      category: line.querySelector(".simple-work").value.trim(),
      description: line.querySelector(".simple-description").value.trim(),
      qty: unchangedAmount ? original.qty : 1,
      unitPrice: unchangedAmount ? original.unitPrice : total
    };
  });
}

function updateSimpleTotal() {
  const subtotal = simpleLineItems().reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const issuer = invoiceIssuerById(document.querySelector("#simple-issuer").value);
  document.querySelector("#simple-total").textContent = `Base: ${money.format(subtotal)} · IVA (${issuer.vat}%): ${money.format(subtotal * issuer.vat / 100)} · Total: ${money.format(subtotal * (1 + issuer.vat / 100))}`;
}

function toggleSimpleNewClient() {
  const isNew = document.querySelector("#simple-client").value === "new";
  document.querySelector("#simple-new-client-label").hidden = !isNew;
  document.querySelector("#simple-new-client").required = isNew;
}

function resetSimpleInvoiceForm() {
  document.querySelector("#simple-invoice-form").reset();
  document.querySelector("#simple-editing-id").value = "";
  document.querySelector("#simple-invoice-title").textContent = "Nueva factura";
  document.querySelector("#save-simple-invoice").textContent = "Crear factura";
  document.querySelector("#simple-client").value = "";
  const today = new Date();
  const issuer = currentInvoiceIssuer();
  document.querySelector("#simple-issuer").value = issuer.id;
  document.querySelector("#simple-number").value = nextInvoiceNumber();
  document.querySelector("#simple-issue-date").value = isoDate(today);
  document.querySelector("#simple-due-date").value = isoDate(addDays(today, issuer.paymentTermsInvoice));
  document.querySelector("#simple-lines").innerHTML = "";
  toggleSimpleNewClient();
  addSimpleLine();
}

function editSimpleInvoice(invoice) {
  resetSimpleInvoiceForm();
  document.querySelector("#simple-editing-id").value = invoice.id;
  document.querySelector("#simple-invoice-title").textContent = `Editando ${escapeHtml(invoice.number)}`;
  document.querySelector("#save-simple-invoice").textContent = "Guardar cambios";
  document.querySelector("#simple-client").value = invoice.clientId;
  document.querySelector("#simple-issuer").value = invoice.issuerId;
  document.querySelector("#simple-number").value = invoice.number;
  document.querySelector("#simple-issue-date").value = invoice.issueDate;
  document.querySelector("#simple-due-date").value = invoice.dueDate;
  document.querySelector("#simple-status").value = invoice.status;
  document.querySelector("#simple-notes").value = invoice.notes || "";
  document.querySelector("#simple-lines").innerHTML = "";
  invoiceLineItems(invoice).forEach(addSimpleLine);
  changeView("new-invoice");
  document.querySelector("#simple-invoice-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateFeeAmount() {
  const monthlyFee = Number(document.querySelector("#invoice-monthly-fee").value) || 0;
  const monthDays = Number(document.querySelector("#invoice-month-days").value) || 1;
  const workDays = Number(document.querySelector("#invoice-work-days").value) || 0;
  const amount = monthDays > 0 ? monthlyFee / monthDays * workDays : 0;
  document.querySelector("#invoice-fee-amount").value = amount.toFixed(2);
}

function statusLabel(status) {
  return {
    pending: "Pendiente",
    partial: "Pago parcial",
    cancelled: "Anulada",
    paid: "Pagada",
    overdue: "Vencida",
    sent: "Presentado",
    accepted: "Aceptado",
    rejected: "No aceptado"
  }[status];
}

function statusBadge(status) {
  return `<span class="status ${status}">${statusLabel(status)}</span>`;
}

function updateQuoteStatus(quoteId, status) {
  quotes = quotes.map((quote) => quote.id === Number(quoteId) ? { ...quote, status } : quote);
  saveQuotes();
  renderAll();
}

function renderMetrics() {
  const totalBilled = invoices.filter((invoice) => (invoice.currency || "EUR") === "EUR" && !invoice.cancelled).reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = invoices.filter((invoice) => (invoice.currency || "EUR") === "EUR" && !invoice.cancelled).reduce((sum, invoice) => sum + collection(invoice).paid, 0);
  const pending = invoices.filter((invoice) => (invoice.currency || "EUR") === "EUR" && !invoice.cancelled).reduce((sum, invoice) => sum + collection(invoice).balance, 0);
  const overdue = invoices.filter((invoice) => (invoice.currency || "EUR") === "EUR" && collection(invoice).overdue).reduce((sum, invoice) => sum + collection(invoice).balance, 0);
  const activeQuotes = quotes.filter((quote) => quote.status === "sent").reduce((sum, quote) => sum + quoteAmount(quote), 0);

  document.querySelector("#metrics").innerHTML = [
    ["Facturado", money.format(totalBilled), "Incluye IVA · EUR"],
    ["Cobrado", money.format(paid), "Incluye cobros parciales · EUR"],
    ["Pendiente", money.format(pending), "Por cobrar · EUR"],
    ["Vencido", money.format(overdue), "Saldo fuera de plazo · EUR"],
    ["Presupuestado", money.format(activeQuotes), "Pendiente de respuesta"]
  ].map(([label, value, note]) => `
    <article class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join("");
}

function renderBusinessStrip() {
  const issuer = currentInvoiceIssuer();
  document.querySelector("#business-strip").innerHTML = `
    <div>
      <strong>${business.brand}</strong>
      <span>Nombre de la app y presupuestos</span>
    </div>
    <div>
      <strong>${escapeHtml(issuer.fiscalName || issuer.label)}</strong>
      <span>Emisor facturas · NIF ${escapeHtml(issuer.taxId || "pendiente")}</span>
    </div>
    <div>
      <strong>IVA ${issuer.vat}%</strong>
      <span>Factura a ${issuer.paymentTermsInvoice} días · presupuesto válido ${business.quoteValidity} días</span>
    </div>
  `;
}

function renderDashboard() {
  const pendingInvoices = invoices.filter((invoice) => !invoice.cancelled && collection(invoice).balance > 0);
  document.querySelector("#pending-count").textContent = `${pendingInvoices.length} abiertas`;
  document.querySelector("#pending-table").innerHTML = pendingInvoices.map((invoice) => `
    <tr class="clickable-row" data-open-invoice="${invoice.id}">
      <td>${escapeHtml(invoice.number)}</td>
      <td>${escapeHtml(clientName(invoice.clientId))}</td>
      <td>${formatDate(invoice.dueDate)}</td>
      <td>${invoiceMoney(collection(invoice).balance, invoice)}</td>
      <td>${collectionBadge(invoice)}</td>
    </tr>
  `).join("");

  const activeQuotes = quotes.filter((quote) => quote.status !== "rejected");
  document.querySelector("#quote-count").textContent = `${activeQuotes.length} en seguimiento`;
  document.querySelector("#quote-list").innerHTML = activeQuotes.map((quote) => `
    <article class="activity-item clickable-card" data-open-quote="${quote.id}">
      <strong>${escapeHtml(quote.number)} · ${escapeHtml(clientName(quote.clientId))}</strong>
      <span>${quoteSummary(quote)} · Total ${money.format(quoteAmount(quote))}</span>
    </article>
  `).join("");
}

function renderClients() {
  document.querySelector("#clients-total").textContent = `${clients.length} clientes`;
  document.querySelector("#clients-table").innerHTML = clients.map((client) => {
    const billed = invoices.filter((invoice) => invoice.clientId === client.id && !invoice.cancelled && (invoice.currency || "EUR") === "EUR").reduce((sum, invoice) => sum + invoice.amount, 0);
    const pending = invoices.filter((invoice) => invoice.clientId === client.id && !invoice.cancelled && (invoice.currency || "EUR") === "EUR").reduce((sum, invoice) => sum + collection(invoice).balance, 0);
    return `
      <tr class="clickable-row" data-edit-client="${client.id}">
        <td><strong>${escapeHtml(client.name)}</strong><br><span>${escapeHtml(clientFullAddress(client) || "Dirección pendiente")}</span></td>
        <td><strong>${escapeHtml(client.fiscalName || client.name)}</strong><br><span>${escapeHtml(client.taxId || "NIF pendiente")}</span></td>
        <td><strong>${escapeHtml(client.contact || "Sin contacto")}</strong><br><span>${escapeHtml(client.phone || client.contactRole || "")}</span></td>
        <td>${escapeHtml(client.email)}</td>
        <td>${money.format(billed)}</td>
        <td>${money.format(pending)}</td>
        <td>
          <button class="table-action" data-edit-client="${client.id}" type="button">Editar</button>
          <button class="table-action danger-action" data-delete-client="${client.id}" type="button">Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderRates() {
  document.querySelector("#rate-grid").innerHTML = rates.map((rate) => `
    <article class="rate-card">
      <span class="rate-category">${rate.category}</span>
      <h3>${rate.name}</h3>
      <p>${rate.description}</p>
      <strong>${money.format(rate.price)}</strong>
      <span> / ${rate.unit}</span>
    </article>
  `).join("");
}

function renderOptions() {
  const clientOptions = clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
  const issuerOptions = invoiceIssuers.map((issuer) => `<option value="${escapeHtml(issuer.id)}">${escapeHtml(issuer.label)}${issuer.active ? " · por defecto" : ""}</option>`).join("");
  const options = {
    "#quote-client": clientOptions,
    "#invoice-client": clientOptions,
    "#invoice-issuer": issuerOptions,
    "#simple-client": `<option value="">Selecciona un cliente</option>${clientOptions}<option value="new">+ Nuevo cliente</option>`,
    "#simple-issuer": issuerOptions
  };
  Object.entries(options).forEach(([selector, html]) => {
    const select = document.querySelector(selector);
    const previous = select.value;
    select.innerHTML = html;
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  });
}

function renderQuotes() {
  document.querySelector("#quotes-total").textContent = `${quotes.length} presupuestos`;
  document.querySelector("#quotes-table").innerHTML = quotes.map((quote) => {
    const linkedInvoice = invoiceForQuote(quote.number);
    return `
      <tr>
        <td class="clickable-cell" data-open-quote="${quote.id}"><strong>${escapeHtml(quote.number)}</strong><br><span>${escapeHtml(quote.fileName || quoteSummary(quote))}</span></td>
        <td>${escapeHtml(clientName(quote.clientId))}</td>
        <td>${money.format(quoteAmount(quote))}</td>
        <td>${statusBadge(quote.status)}</td>
        <td>
          <button class="table-action" data-open-quote="${quote.id}" type="button">Ver</button>
          ${linkedInvoice ? `<button class="table-action" data-open-invoice="${linkedInvoice.id}" type="button">${escapeHtml(linkedInvoice.number)}</button>` : `<button class="table-action" data-convert="${quote.id}" type="button">Convertir</button>`}
          <button class="table-action" data-quote-status="accepted" data-quote-id="${quote.id}" type="button">Marcar aceptado</button>
          <button class="table-action" data-quote-status="rejected" data-quote-id="${quote.id}" type="button">No aceptado</button>
          <button class="table-action danger-action" data-delete-quote="${quote.id}" type="button">Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderInvoices() {
  const search = document.querySelector("#invoice-search").value.trim().toLocaleLowerCase("es");
  const filter = document.querySelector("#invoice-filter").value;
  const items = invoices.filter((i) => {
    const info = collection(i);
    return `${i.number} ${clientName(i.clientId)}`.toLocaleLowerCase("es").includes(search) &&
      (filter === "all" || (filter === "overdue" ? info.overdue : filter === info.status));
  });
  document.querySelector("#invoices-table").innerHTML = items.map((invoice) => `
    <tr>
      <td class="clickable-cell" data-open-invoice="${invoice.id}">${escapeHtml(invoice.number)}</td>
      <td><strong>${escapeHtml(clientName(invoice.clientId))}</strong><br><span>${escapeHtml(invoiceIssuerById(invoice.issuerId).label)}</span>${invoice.notes ? `<br><span>${escapeHtml(invoice.notes)}</span>` : ""}</td>
      <td>${formatDate(invoice.issueDate)}</td>
      <td>${formatDate(invoice.dueDate)}${collection(invoice).overdue ? `<br><small>${collection(invoice).daysLate} días de retraso</small>` : ""}</td>
      <td>${invoiceMoney(invoice.amount, invoice)}<br><small>Pendiente: ${invoiceMoney(collection(invoice).balance, invoice)}</small></td>
      <td>${collectionBadge(invoice)}</td>
      <td class="table-actions">
        <button class="table-action" data-edit-invoice="${invoice.id}" type="button">Editar</button>
        <button class="table-action" data-open-invoice="${invoice.id}" type="button">Ver</button>
        <button class="table-action" data-payment="${invoice.id}" type="button">Cobros</button>
        ${collection(invoice).balance > 0 && !invoice.cancelled ? `<button class="table-action" data-mark-paid="${invoice.id}" type="button">Marcar pagada</button>` : ""}
        ${collection(invoice).paid === 0 && !invoice.documentId ? `<button class="table-action danger-action" data-delete-invoice="${invoice.id}" type="button">Eliminar</button>` : ""}
      </td>
    </tr>
  `).join("") || `<tr><td colspan="7">No hay facturas con estos filtros.</td></tr>`;
}

function renderPayments() {
  const lanes = [["overdue", "Vencidas"], ["pending", "Pendientes"], ["partial", "Pagos parciales"], ["paid", "Pagadas"]];
  document.querySelector("#payment-lanes").innerHTML = lanes.map(([status, title]) => {
    const items = invoices.filter((invoice) => {
      const info = collection(invoice);
      return status === "overdue" ? info.overdue : !info.overdue && info.status === status;
    });
    const rows = items.length ? items.map((invoice) => `
      <article class="payment-item">
        <strong>${escapeHtml(invoice.number)} · ${escapeHtml(clientName(invoice.clientId))}</strong>
        <span>${invoiceMoney(collection(invoice).balance, invoice)} pendientes · vence ${formatDate(invoice.dueDate)}</span>
        ${collectionBadge(invoice)}
        <button class="table-action" data-payment="${invoice.id}" type="button">Ver cobros</button>
      </article>
    `).join("") : `<p>No hay facturas en este estado.</p>`;
    return `<section class="payment-lane"><h3>${title}</h3>${rows}</section>`;
  }).join("");
}

function renderBusiness() {
  const issuer = currentInvoiceIssuer();
  document.querySelector("#business-data").innerHTML = `
    <dl class="business-data-list">
      <div><dt>App</dt><dd>${business.brand}</dd></div>
      <div><dt>Presupuestos</dt><dd>${business.quoteBrand}</dd></div>
      <div><dt>Emisor activo</dt><dd>${escapeHtml(issuer.fiscalName || issuer.label)}</dd></div>
      <div><dt>NIF emisor</dt><dd>${escapeHtml(issuer.taxId || "Pendiente")}</dd></div>
      <div><dt>Dirección emisor</dt><dd>${escapeHtml(issuer.address || "Pendiente")}</dd></div>
      <div><dt>Email facturación</dt><dd>${escapeHtml(issuer.email || "Pendiente")}</dd></div>
      <div><dt>Email publico</dt><dd>${business.publicEmail}</dd></div>
      <div><dt>Teléfono</dt><dd>${escapeHtml(issuer.phone || "Pendiente")}</dd></div>
      <div><dt>IBAN</dt><dd>${escapeHtml(issuer.iban || "Pendiente")}</dd></div>
      <div><dt>IVA</dt><dd>${issuer.vat}%</dd></div>
      <div><dt>Pago factura</dt><dd>${issuer.paymentTermsInvoice} días naturales</dd></div>
      <div><dt>Validez presupuesto</dt><dd>${business.quoteValidity} días</dd></div>
    </dl>
  `;

  document.querySelector("#document-list").innerHTML = documents.map((documentItem) => `
    <a class="document-item" href="${encodeURI(documentItem.path)}" target="_blank" rel="noreferrer">
      <span>${documentItem.type}</span>
      <strong>${documentItem.name}</strong>
      <small>${documentItem.path}</small>
    </a>
  `).join("");

  document.querySelector("#issuer-list").innerHTML = invoiceIssuers.map((item) => `
    <article class="issuer-card">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.fiscalName || "Datos fiscales pendientes")}</span>
        <small>${escapeHtml(item.taxId || "NIF pendiente")} · ${escapeHtml(item.email || "email pendiente")}</small>
      </div>
      <div class="issuer-card-actions">
        ${item.active ? `<span class="status accepted">Por defecto</span>` : ""}
        <button class="table-action" data-edit-issuer="${escapeHtml(item.id)}" type="button">Editar</button>
        <button class="table-action danger-action" data-delete-issuer="${escapeHtml(item.id)}" type="button">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function issuerField(id) {
  return document.querySelector(`#issuer-${id}`);
}

function resetIssuerForm() {
  document.querySelector("#issuer-form").reset();
  issuerField("id").value = "";
  issuerField("vat").value = business.vat;
  issuerField("payment-terms").value = business.paymentTermsInvoice;
  issuerField("active").checked = false;
}

function fillIssuerForm(issuer) {
  const normalizedIssuer = normalizeInvoiceIssuer(issuer);
  issuerField("id").value = normalizedIssuer.id;
  issuerField("label").value = normalizedIssuer.label;
  issuerField("fiscal-name").value = normalizedIssuer.fiscalName;
  issuerField("tax-id").value = normalizedIssuer.taxId;
  issuerField("address").value = normalizedIssuer.address;
  issuerField("email").value = normalizedIssuer.email;
  issuerField("phone").value = normalizedIssuer.phone;
  issuerField("bank").value = normalizedIssuer.bank;
  issuerField("iban").value = normalizedIssuer.iban;
  issuerField("vat").value = normalizedIssuer.vat;
  issuerField("payment-terms").value = normalizedIssuer.paymentTermsInvoice;
  issuerField("active").checked = normalizedIssuer.active;
  issuerField("notes").value = normalizedIssuer.notes;
  document.querySelector("#issuer-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function issuerFromForm() {
  const existingId = issuerField("id").value;
  const fiscalName = issuerField("fiscal-name").value.trim();
  return normalizeInvoiceIssuer({
    id: existingId || `issuer-${Date.now()}`,
    label: issuerField("label").value.trim() || fiscalName || "Nuevo emisor",
    fiscalName,
    taxId: issuerField("tax-id").value.trim(),
    address: issuerField("address").value.trim(),
    email: issuerField("email").value.trim(),
    phone: issuerField("phone").value.trim(),
    bank: issuerField("bank").value.trim(),
    iban: issuerField("iban").value.trim(),
    vat: Number(issuerField("vat").value) || business.vat,
    paymentTermsInvoice: Number(issuerField("payment-terms").value) || business.paymentTermsInvoice,
    active: issuerField("active").checked,
    notes: issuerField("notes").value.trim()
  });
}

function deleteInvoiceIssuer(issuerId) {
  const issuer = invoiceIssuerById(issuerId);
  if (!issuer) return;

  const hasInvoices = invoices.some((invoice) => invoice.issuerId === issuer.id);
  if (hasInvoices) {
    alert(`No puedo eliminar ${issuer.label} porque ya tiene facturas asociadas. Así conservamos el histórico fiscal correcto.`);
    return;
  }

  if (invoiceIssuers.length <= 1) {
    alert("Debe quedar al menos un emisor de factura.");
    return;
  }

  if (confirm(`¿Eliminar el emisor ${issuer.label}?`)) {
    const wasActive = issuer.active;
    invoiceIssuers = invoiceIssuers.filter((item) => item.id !== issuer.id);
    if (wasActive || !invoiceIssuers.some((item) => item.active)) {
      invoiceIssuers = invoiceIssuers.map((item, index) => ({ ...item, active: index === 0 }));
    }
    saveInvoiceIssuers();
    if (issuerField("id").value === issuer.id) resetIssuerForm();
    renderAll();
    resetManualInvoiceForm();
    resetSimpleInvoiceForm();
  }
}

function clientField(id) {
  return document.querySelector(`#client-${id}`);
}

function resetClientForm() {
  document.querySelector("#client-form").reset();
  clientField("id").value = "";
  clientField("country").value = "España";
  clientField("payment-terms").value = business.paymentTermsQuote;
  clientField("payment-method").value = "Transferencia";
  document.querySelector("#client-form-title").textContent = "Nuevo cliente";
  document.querySelector("#delete-current-client").hidden = true;
}

function fillClientForm(client) {
  const normalizedClient = normalizeClient(client);
  clientField("id").value = normalizedClient.id;
  clientField("name").value = normalizedClient.name;
  clientField("fiscal-name").value = normalizedClient.fiscalName;
  clientField("tax-id").value = normalizedClient.taxId;
  clientField("contact").value = normalizedClient.contact;
  clientField("contact-role").value = normalizedClient.contactRole;
  clientField("phone").value = normalizedClient.phone;
  clientField("email").value = normalizedClient.email;
  clientField("address").value = normalizedClient.address;
  clientField("postal-code").value = normalizedClient.postalCode;
  clientField("city").value = normalizedClient.city;
  clientField("province").value = normalizedClient.province;
  clientField("country").value = normalizedClient.country;
  clientField("payment-terms").value = normalizedClient.paymentTerms;
  clientField("payment-method").value = normalizedClient.paymentMethod;
  clientField("notes").value = normalizedClient.notes;
  document.querySelector("#client-form-title").textContent = `Editando ${normalizedClient.name}`;
  document.querySelector("#delete-current-client").hidden = false;
  document.querySelector("#client-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteClient(clientId) {
  const client = clientById(Number(clientId));
  if (!client) return;

  const hasInvoices = invoices.some((invoice) => invoice.clientId === client.id);
  const hasQuotes = quotes.some((quote) => quote.clientId === client.id);
  if (hasInvoices || hasQuotes) { alert("Este cliente tiene facturas o presupuestos. Conserva su ficha para mantener el histórico."); return; }
  const relationWarning = "";

  if (confirm(`¿Eliminar ${escapeHtml(client.name)}?${relationWarning}`)) {
    clients = clients.filter((item) => item.id !== client.id);
    saveClients();
    if (Number(clientField("id").value) === client.id) resetClientForm();
    renderAll();
  }
}

function clientFromForm() {
  const existingId = Number(clientField("id").value);
  const nextId = clients.reduce((max, client) => Math.max(max, client.id), 0) + 1;

  return {
    id: existingId || nextId,
    name: clientField("name").value.trim(),
    fiscalName: clientField("fiscal-name").value.trim(),
    taxId: clientField("tax-id").value.trim(),
    contact: clientField("contact").value.trim(),
    contactRole: clientField("contact-role").value.trim(),
    phone: clientField("phone").value.trim(),
    email: clientField("email").value.trim(),
    address: clientField("address").value.trim(),
    postalCode: clientField("postal-code").value.trim(),
    city: clientField("city").value.trim(),
    province: clientField("province").value.trim(),
    country: clientField("country").value.trim(),
    paymentTerms: Number(clientField("payment-terms").value) || business.paymentTermsQuote,
    paymentMethod: clientField("payment-method").value.trim() || "Transferencia",
    notes: clientField("notes").value.trim()
  };
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "Pendiente";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function documentRows(items) {
  let lastCategory = "";
  return items.map((item) => {
    const categoryRow = item.category !== lastCategory ? `<tr class="document-category"><td colspan="4">${escapeHtml(item.category)}</td></tr>` : "";
    lastCategory = item.category;
    return `
      ${categoryRow}
      <tr>
        <td>${escapeHtml(cleanInvoiceLineDescription(item))}</td>
        <td>${item.qty}</td>
        <td>${money.format(item.unitPrice)}</td>
        <td>${money.format(item.qty * item.unitPrice)}</td>
      </tr>
    `;
  }).join("");
}

function documentTotals(subtotal, vatRate = business.vat) {
  const vat = subtotal * (vatRate / 100);
  const total = subtotal + vat;
  return `
    <dl class="document-totals">
      <div><dt>Base imponible</dt><dd>${money.format(subtotal)}</dd></div>
      <div><dt>IVA ${vatRate}%</dt><dd>${money.format(vat)}</dd></div>
      <div class="total-line"><dt>Total</dt><dd>${money.format(total)}</dd></div>
    </dl>
  `;
}

function documentClientBlock(client) {
  return `
    <address>
      <strong>${escapeHtml(client?.fiscalName || client?.name || "Cliente")}</strong>
      ${clientFullAddress(client) ? `<span>${escapeHtml(clientFullAddress(client))}</span>` : ""}
      <span>${escapeHtml(client?.email || "")}</span>
      <span>NIF/CIF: ${escapeHtml(client?.taxId || "Pendiente")}</span>
    </address>
  `;
}

function openQuoteDocument(quoteId) {
  const quote = quotes.find((item) => item.id === Number(quoteId));
  if (!quote) return;

  const client = clientById(quote.clientId);
  const subtotal = quoteSubtotal(quote);
  const subject = `Presupuesto ${escapeHtml(quote.number)} - ${escapeHtml(clientName(quote.clientId))}`;
  const body = `Hola,\n\nTe envío el presupuesto ${escapeHtml(quote.number)} por importe de ${money.format(subtotal)} + IVA.\n\nGracias.`;

  document.querySelector("#document-modal-title").textContent = subject;
  document.querySelector("#email-document").href = mailtoLink(client?.email, subject, body);
  document.querySelector("#document-paper").innerHTML = `
    <article class="print-document">
      <header class="document-header">
        <div>
          <img class="document-logo" src="assets/Logo%20AliHen.pdf.png" alt="AliHen" />
          <p>${business.publicEmail}<br>Tel. ${business.publicPhone}</p>
        </div>
        <div class="document-id">
          <span>Presupuesto</span>
          <strong>${escapeHtml(quote.number)}</strong>
          <small>${statusLabel(quote.status)}</small>
        </div>
      </header>

      <section class="document-parties">
        <div>
          <h3>Emisor</h3>
          <address>
            <strong>${business.quoteBrand}</strong>
            <span>${business.publicEmail}</span>
            <span>Tel. ${business.publicPhone}</span>
          </address>
        </div>
        <div>
          <h3>Cliente</h3>
          ${documentClientBlock(client)}
        </div>
      </section>

      <table class="document-table">
        <thead>
          <tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr>
        </thead>
        <tbody>${documentRows(quoteLineItems(quote))}</tbody>
      </table>

      ${documentTotals(subtotal)}

      <footer class="document-footer">
        <p>${escapeHtml(quote.notes || "")}</p>
        <p>Presupuesto válido por ${business.quoteValidity} días. IVA no incluido en la base. Plazo máximo de pago: ${business.paymentTermsQuote} días naturales desde la emisión de factura.</p>
      </footer>
    </article>
  `;
  showDocumentModal();
}

function openInvoiceDocument(invoiceId) {
  const invoice = invoices.find((item) => item.id === Number(invoiceId));
  if (!invoice) return;
  if (invoice.invoiceType === "imported") { collectionsUI.openPayment(invoice.id); return; }

  const client = clientById(invoice.clientId);
  const issuer = invoiceIssuerById(invoice.issuerId);
  const subtotal = invoiceSubtotal(invoice);
  const subject = `Factura ${escapeHtml(invoice.number)} - ${clientName(invoice.clientId)}`;
  const body = `Hola,\n\nTe envío la factura ${escapeHtml(invoice.number)} por importe de ${money.format(invoice.amount)}.\n\nForma de pago: transferencia bancaria a ${issuer.iban || "IBAN pendiente"}.\n\nGracias.`;

  document.querySelector("#document-modal-title").textContent = subject;
  document.querySelector("#email-document").href = mailtoLink(client?.email, subject, body);
  document.querySelector("#document-paper").innerHTML = `
    <article class="print-document invoice-document">
      <header class="document-header">
        <div>
          <h2>${escapeHtml(issuer.fiscalName || issuer.label)}</h2>
          <p>${escapeHtml(issuer.address || "")}<br>NIF: ${escapeHtml(issuer.taxId || "Pendiente")}<br>${escapeHtml(issuer.email || "")}<br>Tel. ${escapeHtml(issuer.phone || "")}</p>
        </div>
        <div class="document-id">
          <span>Factura</span>
          <strong>${escapeHtml(invoice.number)}</strong>
          <small>${statusLabel(collection(invoice).displayStatus)}</small>
        </div>
      </header>

      <section class="document-meta">
        <div><span>Fecha</span><strong>${formatDate(invoice.issueDate)}</strong></div>
        <div><span>Vencimiento</span><strong>${formatDate(invoice.dueDate)}</strong></div>
        <div><span>Forma de pago</span><strong>Transferencia</strong></div>
        <div><span>IBAN</span><strong>${escapeHtml(issuer.iban || "Pendiente")}</strong></div>
      </section>

      <section class="document-parties">
        <div>
          <h3>Emisor</h3>
          <address>
            <strong>${escapeHtml(issuer.fiscalName || issuer.label)}</strong>
            <span>${escapeHtml(issuer.address || "")}</span>
            <span>NIF: ${escapeHtml(issuer.taxId || "Pendiente")}</span>
          </address>
        </div>
        <div>
          <h3>Cliente</h3>
          ${documentClientBlock(client)}
        </div>
      </section>

      <table class="document-table">
        <thead>
          <tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr>
        </thead>
        <tbody>${documentRows(invoiceLineItems(invoice))}</tbody>
      </table>

      ${documentTotals(subtotal, issuer.vat)}

      <footer class="document-footer">
        <p>${escapeHtml(invoice.notes || "")}</p>
        <p>Plazo máximo de pago: ${issuer.paymentTermsInvoice} días naturales desde la fecha de emisión de la factura.</p>
      </footer>
    </article>
  `;
  showDocumentModal();
}

function mailtoLink(to, subject, body) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to || "")}?${params.toString()}`;
}

function showDocumentModal() {
  document.querySelector("#document-modal").hidden = false;
  document.body.classList.add("document-open");
}

function closeDocumentModal() {
  document.querySelector("#document-modal").hidden = true;
  document.body.classList.remove("document-open");
}

function renderAll() {
  renderMetrics();
  renderBusinessStrip();
  renderDashboard();
  renderClients();
  renderRates();
  renderOptions();
  renderQuotes();
  renderInvoices();
  renderPayments();
  renderBusiness();
  collectionsUI?.render();
}

function changeView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewName}`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  document.querySelector("#view-title").textContent = views[viewName];
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => changeView(button.dataset.view));
});

document.querySelector("#quote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextId = quotes.reduce((max, quote) => Math.max(max, quote.id), 0) + 1;
  const fileInput = document.querySelector("#quote-file");
  const file = fileInput.files?.[0];
  const quoteNumber = document.querySelector("#quote-number").value.trim() || `P-2026-${String(nextId).padStart(3, "0")}`;
  const manualAmount = Number(document.querySelector("#quote-amount").value) || 0;
  const fileData = file ? await fileToDataUrl(file) : "";
  quotes = [
    {
      id: nextId,
      number: quoteNumber,
      clientId: Number(document.querySelector("#quote-client").value),
      serviceId: null,
      qty: 1,
      discount: 0,
      status: document.querySelector("#quote-status").value,
      notes: document.querySelector("#quote-notes").value,
      manualAmount,
      fileName: file?.name || "",
      fileType: file?.type || "",
      fileData,
      fileUrl: ""
    },
    ...quotes
  ];
  saveQuotes();
  event.target.reset();
  renderAll();
});

document.addEventListener("click", (event) => {
  const quoteOpenTarget = event.target.closest("[data-open-quote]");
  const invoiceOpenTarget = event.target.closest("[data-open-invoice]");
  const editClientTarget = event.target.closest("[data-edit-client]");
  const editInvoiceTarget = event.target.closest("[data-edit-invoice]");
  const deleteClientTarget = event.target.closest("[data-delete-client]");
  const deleteQuoteTarget = event.target.closest("[data-delete-quote]");
  const deleteInvoiceTarget = event.target.closest("[data-delete-invoice]");
  const quoteStatusTarget = event.target.closest("[data-quote-status]");
  const invoiceStatusTarget = event.target.closest("[data-invoice-status]");
  const closeTarget = event.target.closest("[data-close-document]");
  const editIssuerTarget = event.target.closest("[data-edit-issuer]");
  const deleteIssuerTarget = event.target.closest("[data-delete-issuer]");
  const convertId = event.target.dataset?.convert;

  if (quoteOpenTarget) {
    const quote = quotes.find((item) => item.id === Number(quoteOpenTarget.dataset.openQuote));
    if (!quote || !openQuoteFile(quote)) {
      openQuoteDocument(quoteOpenTarget.dataset.openQuote);
    }
    return;
  }

  if (invoiceOpenTarget) {
    openInvoiceDocument(invoiceOpenTarget.dataset.openInvoice);
    return;
  }

  if (editClientTarget) {
    const client = clientById(Number(editClientTarget.dataset.editClient));
    if (client) fillClientForm(client);
    return;
  }

  if (editInvoiceTarget) {
    event.stopPropagation();
    editInvoice(editInvoiceTarget.dataset.editInvoice);
    return;
  }

  if (deleteClientTarget) {
    event.stopPropagation();
    deleteClient(deleteClientTarget.dataset.deleteClient);
    return;
  }

  if (deleteQuoteTarget) {
    event.stopPropagation();
    deleteQuote(deleteQuoteTarget.dataset.deleteQuote);
    return;
  }

  if (deleteInvoiceTarget) {
    event.stopPropagation();
    deleteInvoice(deleteInvoiceTarget.dataset.deleteInvoice);
    return;
  }

  if (editIssuerTarget) {
    event.stopPropagation();
    const issuer = invoiceIssuerById(editIssuerTarget.dataset.editIssuer);
    if (issuer) fillIssuerForm(issuer);
    return;
  }

  if (deleteIssuerTarget) {
    event.stopPropagation();
    deleteInvoiceIssuer(deleteIssuerTarget.dataset.deleteIssuer);
    return;
  }

  if (quoteStatusTarget) {
    event.stopPropagation();
    updateQuoteStatus(quoteStatusTarget.dataset.quoteId, quoteStatusTarget.dataset.quoteStatus);
    return;
  }

  if (invoiceStatusTarget) {
    event.stopPropagation();
    collectionsUI.openPayment(invoiceStatusTarget.dataset.invoiceId);
    return;
  }

  if (closeTarget) {
    closeDocumentModal();
    return;
  }

  if (convertId) {
    const quote = quotes.find((item) => item.id === Number(convertId));
    if (!quote) return;

    const nextId = Math.max(0, ...invoices.map((i) => i.id)) + 1;
    const issuer = currentInvoiceIssuer();
    invoices = [
      {
        id: nextId,
        number: nextInvoiceNumber(),
        clientId: quote.clientId,
        issuerId: issuer.id,
        issueDate: todayMadrid(),
        dueDate: isoDate(addDays(new Date(), issuer.paymentTermsInvoice)),
        amount: quoteAmount(quote) * (1 + issuer.vat / 100),
        status: "pending",
        sourceQuote: quote.number,
        notes: quote.notes
      },
      ...invoices
    ];
    quotes = quotes.map((item) => item.id === quote.id ? { ...item, status: "accepted" } : item);
    saveInvoices();
    saveQuotes();
    renderAll();
    changeView("invoices");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDocumentModal();
});

document.querySelector("#print-document").addEventListener("click", () => window.print());

document.querySelector("#add-extra-line").addEventListener("click", () => addExtraLine());

document.querySelector("#extra-lines").addEventListener("click", (event) => {
  if (event.target.closest(".remove-extra-line")) {
    event.target.closest(".extra-line").remove();
  }
});

["#invoice-monthly-fee", "#invoice-month-days", "#invoice-work-days"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", updateFeeAmount);
});

document.querySelector("#invoice-billing-month").addEventListener("change", updateBusinessDaysFromBillingMonth);

document.querySelector("#reset-invoice-form").addEventListener("click", resetManualInvoiceForm);

document.querySelector("#manual-invoice-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const editingInvoiceId = Number(document.querySelector("#editing-invoice-id").value);
  const number = document.querySelector("#invoice-number").value.trim() || nextInvoiceNumber();
  if (invoices.some((invoice) => invoice.id !== editingInvoiceId && invoice.number === number)) {
    alert("Ya existe una factura con ese número. Introduce otro número.");
    return;
  }
  const nextId = invoices.reduce((max, invoice) => Math.max(max, invoice.id), 0) + 1;
  const feeAmount = Number(document.querySelector("#invoice-fee-amount").value) || 0;
  const workDays = Number(document.querySelector("#invoice-work-days").value) || 0;
  const monthDays = Number(document.querySelector("#invoice-month-days").value) || 0;
  const billingMonth = document.querySelector("#invoice-billing-month").value;
  const feeDescription = feeDescriptionParts(document.querySelector("#invoice-fee-description").value).base;
  const issuer = invoiceIssuerById(document.querySelector("#invoice-issuer").value);
  const lineItems = [];

  if (feeAmount > 0) {
    lineItems.push({
      category: "Fee mensual",
      description: workDays ? `${feeDescription} · ${monthLabel(billingMonth)} · ${workDays}/${monthDays} días hábiles` : feeDescription,
      billingMonth,
      monthlyFee: Number(document.querySelector("#invoice-monthly-fee").value) || 0,
      monthDays,
      workDays,
      qty: 1,
      unitPrice: feeAmount
    });
  }

  lineItems.push(...extraLineItems());

  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const invoiceData = {
    id: editingInvoiceId || nextId,
    number,
    clientId: Number(document.querySelector("#invoice-client").value),
    issuerId: issuer.id,
    issueDate: document.querySelector("#invoice-issue-date").value,
    dueDate: document.querySelector("#invoice-due-date").value,
    amount: subtotal * (1 + issuer.vat / 100),
    status: document.querySelector("#invoice-status").value,
    notes: document.querySelector("#invoice-notes").value.trim(),
    billingMonth,
    invoiceType: "fee",
    lineItems
  };

  if (editingInvoiceId && cents(collection(invoices.find((i) => i.id === editingInvoiceId)).paid) > cents(invoiceData.amount)) { alert("El total no puede ser inferior a los cobros registrados."); return; }
  invoices = editingInvoiceId
    ? invoices.map((invoice) => invoice.id === editingInvoiceId ? { ...invoice, ...invoiceData } : invoice)
    : [invoiceData, ...invoices];
  saveInvoices();
  renderAll();
  resetManualInvoiceForm();
  resetSimpleInvoiceForm();
});

document.querySelector("#add-simple-line").addEventListener("click", () => addSimpleLine());
document.querySelector("#reset-simple-invoice").addEventListener("click", resetSimpleInvoiceForm);
document.querySelector("#simple-client").addEventListener("change", toggleSimpleNewClient);
document.querySelector("#simple-invoice-form").addEventListener("input", updateSimpleTotal);
document.querySelector("#simple-issuer").addEventListener("change", () => {
  const issuer = invoiceIssuerById(document.querySelector("#simple-issuer").value);
  const date = document.querySelector("#simple-issue-date").value;
  if (date) document.querySelector("#simple-due-date").value = isoDate(addDays(new Date(`${date}T12:00:00`), issuer.paymentTermsInvoice));
  updateSimpleTotal();
});
document.querySelector("#simple-lines").addEventListener("click", (event) => {
  const button = event.target.closest(".remove-simple-line");
  if (!button) return;
  if (document.querySelectorAll(".simple-work-line").length > 1) button.closest(".simple-work-line").remove();
  updateSimpleTotal();
});
document.querySelector("#simple-invoice-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const editingId = Number(document.querySelector("#simple-editing-id").value);
  const number = document.querySelector("#simple-number").value.trim() || nextInvoiceNumber();
  if (invoices.some((invoice) => invoice.id !== editingId && invoice.number === number)) {
    alert("Ya existe una factura con ese número. Introduce otro número.");
    return;
  }
  const lineItems = simpleLineItems();
  if (!lineItems.length || lineItems.some((item) => !item.category || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) {
    alert("Introduce el trabajo y un importe mayor que cero.");
    return;
  }
  let clientId = Number(document.querySelector("#simple-client").value);
  if (document.querySelector("#simple-client").value === "new") {
    const name = document.querySelector("#simple-new-client").value.trim();
    if (!name) { alert("Introduce el nombre del cliente."); return; }
    const existing = clients.find((client) => client.name.trim().toLocaleLowerCase("es") === name.toLocaleLowerCase("es"));
    if (existing) clientId = existing.id;
    else {
      clientId = clients.reduce((max, client) => Math.max(max, client.id), 0) + 1;
      clients = [normalizeClient({ id: clientId, name }), ...clients];
      saveClients();
    }
  }
  if (!clients.some((client) => client.id === clientId)) { alert("Selecciona un cliente."); return; }
  const issuer = invoiceIssuerById(document.querySelector("#simple-issuer").value);
  const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const data = {
    id: editingId || invoices.reduce((max, invoice) => Math.max(max, invoice.id), 0) + 1,
    number, clientId, issuerId: issuer.id, invoiceType: "simple",
    issueDate: document.querySelector("#simple-issue-date").value,
    dueDate: document.querySelector("#simple-due-date").value,
    status: document.querySelector("#simple-status").value,
    notes: document.querySelector("#simple-notes").value.trim(),
    amount: subtotal * (1 + issuer.vat / 100), lineItems
  };
  if (editingId && cents(collection(invoices.find((i) => i.id === editingId)).paid) > cents(data.amount)) { alert("El total no puede ser inferior a los cobros registrados."); return; }
  invoices = editingId ? invoices.map((invoice) => invoice.id === editingId ? { ...invoice, ...data } : invoice) : [data, ...invoices];
  saveInvoices();
  renderAll();
  resetSimpleInvoiceForm();
  resetManualInvoiceForm();
  changeView("invoices");
});

document.querySelector("#client-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formClient = clientFromForm();
  const exists = clients.some((client) => client.id === formClient.id);
  clients = exists
    ? clients.map((client) => client.id === formClient.id ? formClient : client)
    : [formClient, ...clients];
  saveClients();
  renderAll();
  fillClientForm(formClient);
});

document.querySelector("#issuer-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formIssuer = issuerFromForm();
  const exists = invoiceIssuers.some((issuer) => issuer.id === formIssuer.id);
  invoiceIssuers = invoiceIssuers.map((issuer) => ({
    ...issuer,
    active: formIssuer.active ? false : issuer.active
  }));
  invoiceIssuers = exists
    ? invoiceIssuers.map((issuer) => issuer.id === formIssuer.id ? formIssuer : issuer)
    : [...invoiceIssuers, formIssuer];
  if (!invoiceIssuers.some((issuer) => issuer.active)) {
    invoiceIssuers = invoiceIssuers.map((issuer, index) => ({ ...issuer, active: index === 0 }));
  }
  saveInvoiceIssuers();
  renderAll();
  fillIssuerForm(formIssuer);
});

document.querySelector("#reset-client-form").addEventListener("click", resetClientForm);
document.querySelector("#cancel-client-edit").addEventListener("click", resetClientForm);
document.querySelector("#delete-current-client").addEventListener("click", () => {
  const clientId = Number(clientField("id").value);
  if (clientId) deleteClient(clientId);
});
document.querySelector("#reset-issuer-form").addEventListener("click", resetIssuerForm);

document.querySelector("#add-rate").addEventListener("click", () => {
  const nextId = rates.length + 1;
  rates.push({
    id: nextId,
    name: `Servicio nuevo ${nextId}`,
    unit: "unidad",
    price: 100,
    description: "Servicio pendiente de definir."
  });
  renderAll();
});

document.querySelector("#print-summary").addEventListener("click", () => window.print());
document.querySelector("#export-backup").addEventListener("click", exportBackup);
document.querySelector("#import-backup").addEventListener("click", () => document.querySelector("#backup-file").click());
document.querySelector("#backup-file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importBackup(file);
  event.target.value = "";
});

renderAll();
resetManualInvoiceForm();
resetIssuerForm();
resetSimpleInvoiceForm();

collectionsUI = initializeCollections({
  getState: () => ({ clients, invoiceIssuers, invoices: invoices.map(normalizeInvoice), quotes: quotes.map(sanitizeQuoteForStorage) }),
  readLocalState: () => ({ clients: loadClients(), invoiceIssuers: loadInvoiceIssuers(), invoices: loadInvoices(), quotes: loadQuotes() }),
  setState: (state, prefix = storagePrefix) => {
    storagePrefix = prefix;
    clients = (state.clients || []).map(normalizeClient);
    invoiceIssuers = (state.invoiceIssuers?.length ? state.invoiceIssuers : defaultInvoiceIssuers).map(normalizeInvoiceIssuer);
    invoices = (state.invoices || []).map(normalizeInvoice);
    quotes = state.quotes || [];
    try {
      for (const [key, value] of [["clients", clients], ["invoice-issuers", invoiceIssuers], ["invoices", invoices], ["quotes", quotes.map(sanitizeQuoteForStorage)]]) {
        localStorage.setItem(`${storagePrefix}-${key}`, JSON.stringify(value));
      }
    } catch { alert("No se pudo guardar la copia local. Exporta una copia antes de cerrar."); }
    renderAll();
    resetManualInvoiceForm();
    resetSimpleInvoiceForm();
  },
  render: renderAll
});
collectionsUI.render();
