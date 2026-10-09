import { test, expect } from "@playwright/test";
import { join } from "node:path";

test("Pagos parciales, filtros, alertas y persistencia al recargar", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#collection-alerts")).toContainText("PB-007");
  await page.locator('[data-view="invoices"]').click();
  await page.locator("#invoice-search").fill("PB-007");
  await page.locator("#invoices-table [data-payment]").click();
  await page.locator("#payment-date").fill("2026-08-01");
  await page.locator("#payment-amount").fill("100");
  await page.getByRole("button", { name: "Registrar cobro", exact: true }).click();
  await expect(page.locator("#payment-summary")).toContainText("1.497,20");
  await expect(page.locator("#payment-history")).toContainText("100,00");
  await page.locator("#payment-close").click();
  await expect(page.locator("#invoices-table")).toContainText("Pago parcial");
  await page.reload();
  await page.locator('[data-view="invoices"]').click();
  await page.locator("#invoice-search").fill("PB-007");
  await expect(page.locator("#invoices-table")).toContainText("1.497,20");
  await page.locator("#invoices-table [data-payment]").click();
  await page.getByRole("button", { name: "Registrar cobro", exact: true }).click();
  await expect(page.locator("#payment-summary")).toContainText("Pagada");
  await page.locator("#payment-close").click();
  await page.locator('[data-view="dashboard"]').click();
  await expect(page.locator("#collection-alerts")).not.toContainText("PB-007");
  expect(errors).toEqual([]);
});

test("Anulación retira la alerta y permite reactivar; corregir pagos recalcula saldo", async ({ page }) => {
  await page.goto("/");
  await page.locator('#collection-alerts [data-payment="8"]').click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#payment-cancel-invoice").click();
  await expect(page.locator("#payment-summary")).toContainText("Anulada");
  await expect(page.locator("#collection-alerts")).not.toContainText("PB-007");
  await page.locator("#payment-cancel-invoice").click();
  await expect(page.locator("#collection-alerts")).toContainText("PB-007");
  await page.locator("#payment-amount").fill("10");
  await page.locator("#payment-date").fill("2026-08-01");
  await page.getByRole("button", { name: "Registrar cobro", exact: true }).click();
  await page.locator("[data-remove-payment]").click();
  await expect(page.locator("#payment-summary")).toContainText("1.597,20");
});

test("Datos no confiables de cliente y notas se muestran como texto", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("alihen-clients", JSON.stringify([{ id: 1, name: '<img src=x onerror="window.injection=true">' }]));
    localStorage.setItem("alihen-invoices", JSON.stringify([{ id: 1, number: "XSS-001", clientId: 1, amount: 1, issuerId: "ruecha", dueDate: "2026-01-01", notes: '<img src=x onerror="window.injection=true">' }]));
  });
  await page.goto("/");
  await page.locator('[data-view="invoices"]').click();
  await expect(page.locator("#invoices-table")).toContainText("<img");
  expect(await page.evaluate(() => window.injection)).toBeUndefined();
});

const samples = [
  ["Factura Comercial PB-0010 -NO.MAD.pdf", "PB-010", "80", "16.8", "96.8"],
  ["Factura Comercial PB-009 - LA CASETA AG.pdf", "PB-009", "1522.14", "319.65", "1841.79"],
  ["Factura Comercial PB-015 -F2F.pdf", "PB-015", "600", "126", "726"]
];
for (const [file, number, base, tax, total] of samples) {
  test(`Lectura del PDF aportado: ${number}, revisión y detección de duplicado`, async ({ page }) => {
    test.skip(!process.env.ALIHEN_SAMPLE_DIR, "Necesita los PDF privados aportados, fuera del repositorio.");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.locator('[data-view="invoices"]').click();
    await page.locator("#invoice-pdf").setInputFiles(join(process.env.ALIHEN_SAMPLE_DIR, file));
    await expect(page.locator("#invoice-review")).toBeVisible();
    await expect(page.locator("#review-number")).toHaveValue(number);
    await expect(page.locator("#review-subtotal")).toHaveValue(base);
    await expect(page.locator("#review-taxAmount")).toHaveValue(tax);
    await expect(page.locator("#review-total")).toHaveValue(total);
    await page.locator("#review-issuerName").fill("Emisor de prueba");
    await page.locator("#review-clientName").fill("Cliente de prueba");
    await page.locator("#review-retentionAmount").fill("0");
    await page.locator("#review-issueDate").fill("2026-08-01");
    await page.locator("#review-dueDate").fill("2026-08-16");
    await page.locator("#review-save").click();
    await expect(page.locator("#invoice-review")).toBeHidden();
    await expect(page.locator("#invoices-table")).toContainText(number);
    await page.locator("#invoice-pdf").setInputFiles(join(process.env.ALIHEN_SAMPLE_DIR, file));
    await expect(page.locator("#collection-message")).toContainText("ya se ha importado");
    await page.reload();
    await page.locator('[data-view="invoices"]').click();
    await expect(page.locator("#invoices-table")).toContainText(number);
    expect(errors).toEqual([]);
  });
}
