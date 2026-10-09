import { addPayment, collection, duplicateInvoice, normalizeCollection, todayMadrid, validateExtracted, cents } from "./collections-core.js";
import { CloudAccount } from "./cloud.js";
import { localDraft } from "./pdf-draft.js";

const escape = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (amount, currency = "EUR") => new Intl.NumberFormat("es-ES", { style: "currency", currency, useGrouping: "always" }).format(amount);
const labels = { pending: "Pendiente", partial: "Pago parcial", paid: "Pagada", overdue: "Vencida", cancelled: "Anulada" };

export function initializeCollections(api) {
  const cloud = new CloudAccount();
  let cloudActive = false, syncing = false, syncFailed = false, dirty = false, saving = false;
  let draft = null, objectUrl = null, localSnapshot = null, currentPayment = null, savedVersion = 0, syncTask = null;
  const shell = document.querySelector(".app-shell");
  const setBusy = (busy) => { shell.inert = busy; shell.setAttribute("aria-busy", String(busy)); };
  const $ = (id) => document.getElementById(id);
  const message = (text, error = false) => {
    $("collection-message").textContent = text;
    $("collection-message").className = error ? "notice error" : "notice";
  };
  const renderConnection = () => {
    $("cloud-status").textContent = cloudActive ? syncing ? "Guardando en ALIHEN…" : syncFailed ? "Hay cambios sin guardar en ALIHEN" : "Conectado a ALIHEN" : cloud.user ? "ALIHEN conectado · importa tus datos o carga la cuenta" : cloud.configured ? "Modo local · inicia sesión para usar ALIHEN" : "Modo local · ALIHEN pendiente de configurar";
    $("cloud-login").hidden = Boolean(cloud.user) || !cloud.configured;
    $("cloud-logout").hidden = !cloud.user;
    $("cloud-migrate").hidden = !cloud.user || cloudActive;
    $("cloud-retry").hidden = !cloudActive || !syncFailed;
    $("cloud-load").hidden = !cloud.user;
    $("cloud-help").hidden = cloud.configured;
    $("cloud-identity").textContent = cloud.user?.email || "";
  };
  function sync() {
    if (syncTask) return syncTask;
    if (!cloudActive || !dirty || syncFailed) return Promise.resolve();
    syncTask = runSync().finally(() => { syncTask = null; });
    return syncTask;
  }
  async function runSync() {
    syncing = true;
    renderConnection();
    try {
      while (dirty) {
        dirty = false;
        await cloud.save(api.getState());
      }
      savedVersion++;
    } catch (e) {
      dirty = true;
      syncFailed = true;
      message(e.message, true);
    } finally { syncing = false; renderConnection(); }
  }
  function changed() {
    dirty = true;
    if (cloudActive) setTimeout(sync, 0);
  }
  function render() {
    const state = api.getState();
    const overdue = state.invoices.filter((i) => collection(i).overdue);
    const missing = state.invoices.filter((i) => collection(i).missingDueDate && collection(i).balance > 0 && !i.cancelled);
    $("collection-alerts").innerHTML = `<div class="panel-heading"><h2>Alertas de cobro</h2><span>${overdue.length} vencidas</span></div>` +
      (overdue.length ? overdue.sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map((i) => {
        const info = collection(i);
        const client = state.clients.find((c) => c.id === i.clientId);
        return `<button class="collection-alert" data-payment="${i.id}" type="button"><strong>${escape(i.number)} · ${escape(client?.name || "Sin cliente")}</strong><span>${money(info.balance, i.currency || "EUR")} pendientes · ${info.daysLate} días de retraso${info.status === "partial" ? " · pago parcial" : ""}</span></button>`;
      }).join("") : "<p>No hay facturas vencidas.</p>") + (missing.length ? `<p class="notice">${missing.length} factura(s) sin vencimiento válido. Completa la fecha para controlar el cobro.</p>` : "");
    renderConnection();
  }
  async function loadAccount() {
    if (syncing) throw new Error("Espera a que termine el guardado.");
    const snapshot = await cloud.load();
    if (!snapshot) { cloudActive = false; message("La cuenta de ALIHEN está vacía. Puedes importar una copia local desde Empresa."); }
    else {
      localSnapshot ||= structuredClone(api.getState());
      cloudActive = true;
      dirty = false;
      syncFailed = false;
      api.setState(snapshot, `alihen-cloud-${cloud.user.id}`);
      message("Datos cargados desde ALIHEN. La copia local original se conserva por separado.");
    }
    render();
  }
  $("cloud-login").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    setBusy(true);
    try {
      localSnapshot = structuredClone(api.getState());
      await cloud.login($("cloud-email").value, $("cloud-password").value);
      $("cloud-password").value = "";
      await loadAccount();
    } catch (e) { message(e.message, true); renderConnection(); }
    finally { button.disabled = false; setBusy(false); }
  });
  $("cloud-load").addEventListener("click", async () => {
    if (!confirm("Recargar sustituye la vista actual por los datos de ALIHEN. Exporta una copia antes si tienes cambios sin guardar.")) return;
    try { await loadAccount(); } catch (e) { message(e.message, true); }
  });
  $("cloud-logout").addEventListener("click", async () => {
    if (syncing) { message("Espera a que termine el guardado antes de salir.", true); return; }
    if (dirty && cloudActive && !confirm("Hay cambios sin guardar. Exporta una copia antes de cerrar sesión. ¿Quieres salir igualmente?")) return;
    try {
      await cloud.logout();
      cloudActive = false;
      dirty = false;
      api.setState(localSnapshot || api.readLocalState(), "alihen");
      localSnapshot = null;
      clearDraft();
      $("payment-dialog").close();
      render();
      message("Sesión cerrada. Estás viendo la copia local.");
    } catch(e) { message(e.message, true); }
  });
  $("cloud-migrate").addEventListener("click", async () => {
    if (!confirm("Se copiarán a tu cuenta de ALIHEN los clientes, emisores, presupuestos, facturas y cobros de esta vista. Los datos de ejemplo también se incluirán. ¿Continuar?")) return;
    const button = $("cloud-migrate");
    button.disabled = true;
    setBusy(true);
    try {
      const existing = await cloud.load();
      if (existing) throw new Error("ALIHEN ya contiene datos. Carga la cuenta para evitar sobrescribirlos.");
      const snapshot = structuredClone(api.getState());
      for (const i of snapshot.invoices) {
        if (i.documentHash && !i.documentId) {
          const file = await getLocalPdf(i.documentHash);
          if (!file) throw new Error(`Falta el PDF original de ${i.number} en este navegador. Vuelve a adjuntarlo antes de migrar.`);
          i.documentId = (await cloud.upload(file, i.documentHash)).id;
        }
      }
      await cloud.save(snapshot);
      cloudActive = true;
      dirty = false;
      syncFailed = false;
      localSnapshot ||= structuredClone(snapshot);
      api.setState(snapshot, `alihen-cloud-${cloud.user.id}`);
      message("Copia importada en ALIHEN. La copia local original se conserva.");
      render();
    } catch(e) { message(e.message, true); }
    finally { button.disabled = false; setBusy(false); }
  });
  $("cloud-retry").addEventListener("click", () => { syncFailed = false; sync(); });
  window.addEventListener("beforeunload", (event) => {
    if (cloudActive && (dirty || syncing)) { event.preventDefault(); event.returnValue = ""; }
  });

  function clearDraft() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    draft = null;
    $("invoice-review").hidden = true;
    $("pdf-preview").removeAttribute("src");
    $("invoice-pdf").value = "";
  }
  const fields = ["number", "issuerName", "issuerTaxId", "clientName", "clientTaxId", "issueDate", "dueDate", "currency", "subtotal", "taxAmount", "retentionAmount", "total", "notes"];
  function showDraft(data) {
    draft.data = data;
    fields.forEach((key) => { $("review-" + key).value = data[key] ?? ""; });
    $("review-lines").value = (data.lineItems || []).map((i) => `${i.description || ""} | ${i.qty ?? ""} | ${i.unitPrice ?? ""}`).join("\n");
    $("review-warnings").textContent = (data.warnings || []).join(" · ");
    $("review-errors").textContent = "";
    $("invoice-review").hidden = false;
    $("review-save").disabled = false;
    $("pdf-preview").src = objectUrl;
    $("review-number").focus();
  }
  $("invoice-pdf").addEventListener("change", async () => {
    const file = $("invoice-pdf").files?.[0];
    if (!file || saving) return;
    clearDraft();
    $("import-pdf-button").disabled = true;
    try {
      message("Leyendo PDF…");
      const { readPdf } = await import("./pdf-reader.js");
      const text = await readPdf(file);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");
      if (api.getState().invoices.some((i) => i.documentHash === hash)) throw new Error("Este PDF ya se ha importado.");
      objectUrl = URL.createObjectURL(file);
      draft = { file, hash, documentId: null, text };
      showDraft(localDraft(text));
      message(text.trim() ? "PDF leído. Revisa los datos o pulsa Extraer con GPT." : "PDF sin texto: utiliza GPT para leer la imagen o completa los campos manualmente.");
    } catch(e) { clearDraft(); message(e.message, true); }
    finally { $("import-pdf-button").disabled = false; }
  });
  $("review-cancel").addEventListener("click", clearDraft);
  $("review-gpt").addEventListener("click", async () => {
    if (!draft || saving) return;
    const current = draft;
    const button = $("review-gpt");
    button.disabled = true;
    setBusy(true);
    try {
      if (!cloudActive) throw new Error("Conecta e importa tu cuenta en ALIHEN antes de extraer con GPT.");
      message("Extrayendo con GPT… El PDF se enviará al servicio de extracción.");
      const document = current.documentId ? { id: current.documentId } : await cloud.upload(current.file, current.hash);
      current.documentId = document.id;
      const data = await cloud.extract(document.id);
      if (draft === current && !saving) {
        showDraft(data.result);
        message("Extracción terminada. Confirma los datos antes de guardar.");
      }
    } catch(e) { message(e.message, true); }
    finally { button.disabled = false; setBusy(false); }
  });
  function draftFromForm() {
    const data = { ...draft.data };
    for (const key of fields) {
      const v = $("review-" + key).value.trim();
      data[key] = ["subtotal", "taxAmount", "retentionAmount", "total"].includes(key) ? v === "" ? null : Number(v) : v || null;
    }
    data.lineItems = $("review-lines").value.split("\n").filter((s) => s.trim()).map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new Error("Cada concepto debe tener: descripción | cantidad | precio unitario.");
      return { description: parts[0], qty: Number(parts[1]), unitPrice: Number(parts[2]) };
    });
    return data;
  }
  $("review-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!draft || saving) return;
    saving = true;
    setBusy(true);
    $("review-save").disabled = true;
    const current = draft;
    try {
      const data = draftFromForm();
      const errors = validateExtracted(data);
      if (errors.length) throw new Error(errors.join("\n"));
      const state = structuredClone(api.getState());
      const byIdentity = (list, name, taxId) => list.find((i) => taxId ? i.taxId?.replace(/\W/g, "").toUpperCase() === taxId.replace(/\W/g, "").toUpperCase() : (i.fiscalName || i.name || "").trim().toUpperCase() === name.trim().toUpperCase());
      let client = byIdentity(state.clients, data.clientName, data.clientTaxId);
      if (!client) {
        client = { id: Math.max(0, ...state.clients.map((c) => c.id)) + 1, name: data.clientName, fiscalName: data.clientName, taxId: data.clientTaxId || "" };
        state.clients.push(client);
      }
      let issuer = byIdentity(state.invoiceIssuers, data.issuerName, data.issuerTaxId);
      if (!issuer) {
        issuer = { id: crypto.randomUUID(), label: data.issuerName, fiscalName: data.issuerName, taxId: data.issuerTaxId || "", vat: data.subtotal ? data.taxAmount / data.subtotal * 100 : 0, active: false };
        state.invoiceIssuers.push(issuer);
      }
      const invoice = {
        id: current.invoiceId || Math.max(0, ...state.invoices.map((i) => i.id)) + 1,
        number: data.number, issuerId: issuer.id, clientId: client.id,
        issueDate: data.issueDate, dueDate: data.dueDate, amount: data.total,
        subtotal: data.subtotal, taxAmount: data.taxAmount, retentionAmount: data.retentionAmount,
        currency: data.currency, notes: data.notes || "", invoiceType: "imported",
        lineItems: data.lineItems.map((i) => ({ ...i, category: "Importado" })),
        documentHash: current.hash, documentId: current.documentId, documentName: current.file?.name || current.documentName,
        status: "pending", payments: [], openingPaid: 0
      };
      const old = state.invoices.find((i) => i.id === current.invoiceId);
      if (old) Object.assign(invoice, { payments: old.payments, openingPaid: old.openingPaid, cancelled: old.cancelled });
      if (cents(collection(invoice).paid) > cents(invoice.amount)) throw new Error("El total no puede ser inferior a los cobros registrados.");
      if (duplicateInvoice(state.invoices, invoice)) throw new Error("Ya existe una factura con ese número y emisor, o con el mismo PDF.");
      if (cloudActive && current.file && !current.documentId) {
        const document = await cloud.upload(current.file, current.hash);
        current.documentId = document.id;
        invoice.documentId = document.id;
      }
      state.invoices = old ? state.invoices.map((i) => i.id === old.id ? invoice : i) : [invoice, ...state.invoices];
      if (cloudActive) {
        if (syncing || dirty) { await sync(); if (dirty) throw new Error("Guarda primero los cambios pendientes de ALIHEN."); }
        await cloud.save(state);
      }
      // El PDF se conserva en IndexedDB en modo local, separado de localStorage.
      if (current.file && !cloudActive) await storeLocalPdf(current.hash, current.file);
      api.setState(state);
      dirty = false;
      clearDraft();
      message(cloudActive ? "Factura revisada y guardada en ALIHEN." : "Factura guardada en este navegador. Puedes importarla a ALIHEN cuando conectes la cuenta.");
    } catch(e) { $("review-errors").textContent = e.message; message("No se ha guardado la factura. Revisa los campos indicados.", true); }
    finally { saving = false; setBusy(false); $("review-save").disabled = false; renderConnection(); }
  });

  function openPayment(id) {
    const state = api.getState();
    const invoice = state.invoices.find((i) => i.id === Number(id));
    if (!invoice) return;
    currentPayment = invoice.id;
    const info = collection(invoice);
    $("payment-title").textContent = `Cobros · ${invoice.number}`;
    $("payment-summary").textContent = `Total: ${money(invoice.amount, invoice.currency || "EUR")} · Cobrado: ${money(info.paid, invoice.currency || "EUR")} · Pendiente: ${money(info.balance, invoice.currency || "EUR")} · ${labels[info.displayStatus]}`;
    $("payment-date").value = todayMadrid();
    $("payment-date").max = todayMadrid();
    $("payment-amount").value = info.balance.toFixed(2);
    $("payment-amount").max = info.balance.toFixed(2);
    $("payment-note").value = "";
    $("payment-error").textContent = "";
    $("payment-form").hidden = info.balance === 0 || invoice.cancelled;
    $("payment-cancel-invoice").textContent = invoice.cancelled ? "Reactivar factura" : "Anular factura";
    $("payment-cancel-invoice").disabled = info.paid > 0 && !invoice.cancelled;
    $("payment-original").hidden = !invoice.documentHash && !invoice.documentId;
    $("payment-history").innerHTML = (invoice.openingPaid ? `<div class="payment-history-row"><span>Cobro histórico sin fecha: ${money(invoice.openingPaid, invoice.currency || "EUR")}</span><button class="table-action danger-action" data-remove-opening type="button">Corregir cobro histórico</button></div>` : "") +
      ((invoice.payments || []).map((p) => `<div class="payment-history-row"><span>${escape(p.date)} · ${money(p.amount, invoice.currency || "EUR")} · ${escape(p.note || "")}</span><button class="table-action danger-action" data-remove-payment="${escape(p.id)}" type="button">Corregir / eliminar</button></div>`).join("") || "<p>No hay pagos registrados.</p>");
    $("payment-dialog").showModal();
  }
  $("payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const state = structuredClone(api.getState());
      state.invoices = state.invoices.map((i) => i.id === currentPayment ? addPayment(i, { id: crypto.randomUUID(), date: $("payment-date").value, amount: Number($("payment-amount").value), note: $("payment-note").value.trim() }) : i);
      api.setState(state);
      changed();
      openPayment(currentPayment);
    } catch(e) { $("payment-error").textContent = e.message; }
  });
  $("payment-close").addEventListener("click", () => $("payment-dialog").close());
  $("payment-cancel-invoice").addEventListener("click", () => {
    if (!confirm("¿Quieres cambiar la anulación de esta factura?")) return;
    const state = structuredClone(api.getState());
    state.invoices = state.invoices.map((i) => i.id === currentPayment && collection(i).paid === 0 ? { ...i, cancelled: !i.cancelled, status: "pending" } : i);
    api.setState(state);
    changed();
    openPayment(currentPayment);
  });
  $("payment-original").addEventListener("click", async () => {
    const invoice = api.getState().invoices.find((i) => i.id === currentPayment);
    const tab = window.open("about:blank", "_blank");
    try {
      let url;
      if (cloudActive && invoice.documentId) url = await cloud.documentUrl(invoice.documentId);
      else {
        const file = await getLocalPdf(invoice.documentHash);
        if (!file) throw new Error("El PDF no está en este navegador. Vuelve a adjuntarlo o consulta ALIHEN.");
        url = URL.createObjectURL(file);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      if (tab) { tab.opener = null; tab.location.href = url; }
      else throw new Error("El navegador ha bloqueado la ventana. Permite abrir el PDF.");
    } catch(e) { tab?.close(); $("payment-error").textContent = e.message; }
  });
  document.addEventListener("click", (event) => {
    const payment = event.target.closest("[data-payment]");
    if (payment) { event.stopPropagation(); openPayment(payment.dataset.payment); }
    const remove = event.target.closest("[data-remove-payment]");
    if (event.target.closest("[data-remove-opening]") && confirm("¿Quitar la marca histórica de pagada? El saldo volverá a estar pendiente de cobro.")) {
      const state = structuredClone(api.getState());
      state.invoices = state.invoices.map((i) => i.id === currentPayment ? { ...i, openingPaid: 0, status: "pending" } : i);
      api.setState(state);
      changed();
      openPayment(currentPayment);
    }
    if (remove && confirm("¿Eliminar este cobro registrado por error? El saldo pendiente se recalculará.")) {
      const state = structuredClone(api.getState());
      state.invoices = state.invoices.map((i) => i.id === currentPayment ? { ...i, status: "pending", payments: i.payments.filter((p) => p.id !== remove.dataset.removePayment) } : i);
      api.setState(state);
      changed();
      openPayment(currentPayment);
    }
  });
  function editImported(invoice) {
    clearDraft();
    draft = { invoiceId: invoice.id, hash: invoice.documentHash, documentId: invoice.documentId, documentName: invoice.documentName };
    const state = api.getState();
    const issuer = state.invoiceIssuers.find((i) => i.id === invoice.issuerId);
    const client = state.clients.find((i) => i.id === invoice.clientId);
    showDraft({ number: invoice.number, issuerName: issuer?.fiscalName || issuer?.label, issuerTaxId: issuer?.taxId,
      clientName: client?.fiscalName || client?.name, clientTaxId: client?.taxId,
      issueDate: invoice.issueDate, dueDate: invoice.dueDate, subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount, retentionAmount: invoice.retentionAmount || 0,
      total: invoice.amount, currency: invoice.currency || "EUR", notes: invoice.notes, lineItems: invoice.lineItems || [] });
    $("review-gpt").disabled = true;
    if (cloudActive && invoice.documentId) cloud.documentUrl(invoice.documentId).then((url) => {
      if (draft?.invoiceId === invoice.id) $("pdf-preview").src = url;
    }).catch((e) => message(e.message, true));
    else if (invoice.documentHash) getLocalPdf(invoice.documentHash).then((file) => {
      if (file && draft?.invoiceId === invoice.id) { objectUrl = URL.createObjectURL(file); $("pdf-preview").src = objectUrl; }
    }).catch((e) => message(e.message, true));
    $("invoice-review").scrollIntoView({ behavior: "smooth" });
  }
  $("import-pdf-button").addEventListener("click", () => {
    $("review-gpt").disabled = false;
    $("invoice-pdf").click();
  });
  $("invoice-search").addEventListener("input", api.render);
  $("invoice-filter").addEventListener("change", api.render);
  let day = todayMadrid();
  setInterval(() => { const current = todayMadrid(); if (day !== current) { day = current; api.render(); } }, 30000);
  window.addEventListener("focus", () => api.render());
  async function boot() {
    try {
      if (await cloud.session()) { localSnapshot = structuredClone(api.getState()); await loadAccount(); }
    } catch(e) { message("No se pudo cargar ALIHEN: " + e.message, true); }
    renderConnection();
  }
  boot();
  return { render, changed, openPayment, editImported, cloud, get cloudActive() { return cloudActive; }, get savedVersion() { return savedVersion; } };
}

async function pdfDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("alihen-pdfs", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pdfs");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se puede guardar el PDF en este navegador."));
  });
}
async function storeLocalPdf(hash, file) {
  const db = await pdfDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("pdfs", "readwrite");
      tx.objectStore("pdfs").put(file, hash);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(new Error("No se ha podido conservar el PDF local. Revisa el espacio disponible."));
      tx.onabort = tx.onerror;
    });
  } finally { db.close(); }
}
async function getLocalPdf(hash) {
  const db = await pdfDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("pdfs").objectStore("pdfs").get(hash);
      request.onsuccess = () => resolve(request.result);
      request.onerror = reject;
    });
  } finally { db.close(); }
}
