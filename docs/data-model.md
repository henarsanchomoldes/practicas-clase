# Modelo de datos

| Entidad | Contenido |
|---|---|
| alihen_workspaces | Propietario, revisión y JSON de clientes, emisores y presupuestos originales. |
| alihen_invoices | Propietario/id local, número único por emisor, cliente, fechas, moneda, total, cobro histórico, anulación y documento; JSON conserva conceptos y otros campos. |
| alihen_payments | UUID, propietario, factura, fecha, importe positivo y referencia. |
| alihen_documents | UUID, propietario, ruta, nombre, SHA-256, estado, resultado y código de error. |
| alihen_collection_status | Vista con saldo, estado y vencimiento calculados. |

Clientes y emisores permanecen en el workspace para preservar fichas existentes; la RPC valida sus relaciones. No hay tablas separadas de clientes en esta fase. Bucket privado alihen-invoices, rutas owner/uuid.pdf y documentos únicos por SHA/usuario.

Procesamiento: pending → processing → needs_review → reviewed; error permite reintentar. La extracción no confirma facturas automáticamente. Cobro: pendiente, parcial, pagada o anulada. Vencida es una condición independiente con fechas Madrid. Una anulación retira el saldo exigible.

RLS permite leer únicamente lo propio. Escrituras financieras mediante alihen_save_account: autenticación, validación de relaciones y totales, control de revisión y transacción. Sin acceso anónimo. Los documentos confirmados y las facturas con cobros no se borran mediante sincronización ordinaria.

Migración preparada en supabase/migrations/20261009100000_alihen_collections.sql; probada en PostgreSQL local, no aplicada a ALIHEN. Sin seed de datos personales.
