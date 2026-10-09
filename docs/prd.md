# Producto — AliHen

Seguimiento de cobros de facturas emitidas a clientes por un profesional freelance. Se conservan clientes, emisores, presupuestos y facturas simples/con fee de la aplicación recibida.

Alcance confirmado: importar PDF, extraer con GPT, revisar antes de guardar, almacenar en Supabase ALIHEN, registrar pagos totales/parciales, calcular saldos y vencimientos, mostrar alertas internas y conservar la copia local.

Criterios: leer los tres PDF sin confundir archivo con número de factura; no inventar campos; saldo consistente; fechas Europe/Madrid; aislamiento por usuario; fallos recuperables. Un pago parcial puede seguir vencido, uno completo retira la alerta.

Fuera de alcance: correos de reclamación, conciliación bancaria, devoluciones, rectificativas, registro público, equipos compartidos y conversión de divisas. No hay reglas de un programa específico de ayudas.
