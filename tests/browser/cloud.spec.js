import { test, expect } from "@playwright/test";

test("Inicio de sesión, importación de copia, guardado y aislamiento al cerrar sesión", async ({ page }) => {
  const owner = "11111111-1111-4111-8111-111111111111";
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url")}.test`;
  let snapshot = null, revision = null;
  const saved = [];
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = route.request().url();
    const json = (body, status=200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/auth/v1/token")) return json({ access_token: jwt, token_type: "bearer", expires_in: 3600, refresh_token: "test-refresh", user: { id: owner, email: "test@example.com", aud: "authenticated" } });
    if (url.includes("/auth/v1/logout")) return json({});
    if (url.includes("/auth/v1/user")) return json({ id: owner, email: "test@example.com" });
    if (url.includes("/rpc/alihen_load_account")) return json(snapshot ? { snapshot, revision } : null);
    if (url.includes("/rpc/alihen_save_account")) {
      const body = route.request().postDataJSON();
      expect(body.expected_revision).toBe(revision);
      snapshot = body.snapshot;
      saved.push(structuredClone(snapshot));
      revision = (revision || 0)+1;
      return json(revision);
    }
    return json({ message: "Unexpected test request" }, 400);
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.locator('[data-view="business"]').click();
  await page.locator("#cloud-email").fill("test@example.com");
  await page.locator("#cloud-password").fill("test-password");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.locator("#cloud-migrate")).toBeVisible();
  await page.locator("#cloud-migrate").click();
  await expect(page.locator("#cloud-status")).toHaveText("Conectado a ALIHEN");
  expect(saved).toHaveLength(1);
  await page.locator('[data-view="invoices"]').click();
  await page.locator("#invoice-search").fill("PB-007");
  await page.locator("#invoices-table [data-payment]").click();
  await page.locator("#payment-amount").fill("20");
  await page.locator("#payment-date").fill("2026-08-01");
  await page.getByRole("button", { name: "Registrar cobro", exact: true }).click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].invoices.find((i) => i.number === "PB-007").payments[0].amount).toBe(20);
  await page.locator("#payment-close").click();
  await page.locator('[data-view="business"]').click();
  await expect(page.locator("#cloud-status")).toHaveText("Conectado a ALIHEN");
  await page.locator("#cloud-logout").click();
  await expect(page.locator("#cloud-login")).toBeVisible();
  await page.locator('[data-view="invoices"]').click();
  await page.locator("#invoice-search").fill("PB-007");
  await page.locator("#invoices-table [data-payment]").click();
  await expect(page.locator("#payment-history")).toContainText("No hay pagos registrados");
  expect(saved).toHaveLength(2);
});

test("Un fallo de guardado conserva el pago local y permite reintentar", async ({ page }) => {
  const owner = "22222222-2222-4222-8222-222222222222";
  const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url")}.test`;
  let saves = 0;
  const snapshot = { clients: [{ id: 1, name: "Cliente nube" }], invoiceIssuers: [{ id: "issuer", label: "Emisor nube" }], quotes: [], invoices: [{ id: 1, number: "CLOUD-001", issuerId: "issuer", clientId: 1, amount: 100, dueDate: "2026-01-10", openingPaid: 0, payments: [] }] };
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = route.request().url();
    const json = (body, status=200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.includes("/auth/v1/token")) return json({ access_token: jwt, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user: { id: owner, email: "test@example.com" } });
    if (url.includes("/rpc/alihen_load_account")) return json({ snapshot, revision: 1 });
    if (url.includes("/rpc/alihen_save_account")) {
      saves++;
      if (saves === 1) return json({ message: "Simulated connection failure", code: "test" }, 400);
      expect(route.request().postDataJSON().snapshot.invoices[0].payments[0].amount).toBe(20);
      return json(2);
    }
    return json({});
  });
  await page.goto("/");
  await page.locator('[data-view="business"]').click();
  await page.locator("#cloud-email").fill("test@example.com");
  await page.locator("#cloud-password").fill("test-password");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.locator("#cloud-status")).toHaveText("Conectado a ALIHEN");
  await page.locator('[data-view="invoices"]').click();
  await page.locator("#invoices-table [data-payment]").click();
  await page.locator("#payment-amount").fill("20");
  await page.locator("#payment-date").fill("2026-08-01");
  await page.getByRole("button", { name: "Registrar cobro", exact: true }).click();
  await expect(page.locator("#collection-message")).toContainText("No se pudo guardar");
  await expect(page.locator("#payment-summary")).toContainText("80,00");
  await page.locator("#payment-close").click();
  await page.locator('[data-view="business"]').click();
  await page.locator("#cloud-retry").click();
  await expect(page.locator("#cloud-status")).toHaveText("Conectado a ALIHEN");
  expect(saves).toBe(2);
});
