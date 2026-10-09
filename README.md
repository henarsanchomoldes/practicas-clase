# AliHen — seguimiento de cobros

Gestor de clientes, presupuestos y facturas emitidas, con importación de PDF, revisión, pagos parciales y alertas de vencimiento. Conserva la interfaz original. No envía correos de reclamación.

## Desarrollo

Node.js ≥22.13 y pnpm 11.19.0. Servir mediante HTTP; no abrir index.html con file://.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# La URL y la clave pública de ALIHEN ya están en .env.example.
pnpm dev
```

En Codex usar cachés escribibles:

```bash
export XDG_DATA_HOME=/workspace/.cache/pnpm-data
export XDG_CACHE_HOME=/workspace/.cache
pnpm install --frozen-lockfile --store-dir /workspace/.cache/pnpm-store
pnpm dev
```

VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY son públicas. Nunca usar VITE_ para claves de OpenAI o service_role. Ver [PONER_EN_MARCHA.md](PONER_EN_MARCHA.md) para activar Supabase y GPT.

## Conservar los datos

Abrir el gestor original en el navegador habitual y exportar JSON desde Empresa antes de cambiar de URL o carpeta. Los datos locales dependen del origen del navegador y no vienen en el ZIP. Importar ese JSON en la nueva aplicación antes de migrar a ALIHEN.

La copia local utiliza localStorage y guarda los PDF nuevos en IndexedDB. La cuenta nube se guarda por separado de la copia local. La importación a ALIHEN solo acepta una cuenta vacía y requiere confirmación; incluye los datos de ejemplo si siguen en la vista. Las copias JSON incluyen cobros y datos, pero no los PDF nuevos de IndexedDB: conservar los originales. Este módulo no migra los adjuntos antiguos de presupuestos a Storage.

## Reglas de cobro

Estado pendiente, parcial, pagada o anulada según los cobros. Vencida es una condición independiente: fecha anterior al día actual de Madrid y saldo positivo. Vencer hoy no implica estar vencida. Las fechas ausentes requieren revisión. Las alertas se recalculan al abrir, al registrar cambios y al cambiar de día; no hay tarea de correos ni alertas externas persistentes.

Los cobros históricos sin fecha se conservan y pueden corregirse. No se puede reducir el total por debajo de lo cobrado ni anular una factura con cobros sin corregirlos previamente. No se implementan devoluciones ni rectificativas. Cada factura conserva su moneda; los agregados del panel y clientes suman EUR sin convertir divisas.

## Pruebas y compilación

```bash
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm preview
```

Las pruebas de conexión simulada requieren las variables públicas en .env.local. ALIHEN_SAMPLE_DIR activa las tres pruebas con los PDF privados aportados; no se incluyen en Git ni en la web. CHROMIUM_PATH permite usar un Chromium instalado.

dist/ contiene la web para alojamiento estático. El despliegue de la web y la activación real de ALIHEN están pendientes. Ver [docs/testing.md](docs/testing.md).
