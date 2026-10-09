# Flujos

Importar: Facturas → PDF → lectura local y vista original → GPT opcional con sesión nube → revisión → validar importes y duplicados → confirmar. Los campos ausentes se completan manualmente. Un error conserva el documento para reintentar. Interfaz limitada a 10 MB y 20 páginas.

Cobrar: factura/alerta → Cobros → fecha e importe → registrar → recalcular saldo. Pago parcial mantiene alerta si queda vencido; pago completo la retira. Los cobros erróneos y marcas históricas pueden corregirse con confirmación.

Migrar: exportar JSON en el gestor original → importar en la nueva web → iniciar sesión → importar copia a cuenta vacía con confirmación. No sobrescribir una cuenta existente. Cerrar sesión vuelve a la copia local.

Fallos: aviso de cambios sin guardar, copia local conservada y opción de reintentar/exportar. Si cambió otra sesión, impedir sobrescritura y conservar copia antes de recargar.

Acceso rápido: Facturas → Marcar pagada → confirmar fecha y Registrar cobro. El importe se prellena con el saldo restante; se permite indicar la fecha real sin inventar cuándo se cobró. Las marcas pagadas del gestor anterior se conservan como cobros históricos sin fecha.
