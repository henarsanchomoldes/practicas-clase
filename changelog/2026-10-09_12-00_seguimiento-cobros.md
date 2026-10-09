# Seguimiento de cobros e importación de facturas

**Fecha:** 2026-10-09 12:00 Europe/Madrid
**Tipo:** Feature

## Qué se hizo

Integrada la aplicación recibida manteniendo clientes, emisores, presupuestos y facturas. Añadidos revisión de PDF, cobros parciales, saldos, vencimientos Madrid y alertas. Preparados Supabase con RLS/Storage privado y función GPT con JSON estricto. Sin correos automáticos.

## Qué se modificó

HTML/CSS/JS y módulos nuevos, package.json/lockfile pnpm, migración y función, pruebas, README y docs. Sin claves privadas en el código ni PDF privados nuevos en la distribución.

## Por qué

Controlar facturas emitidas y reducir entrada manual, conservando el gestor existente. Revisión humana y separación de procesamiento/pago/vencimiento para evitar contabilizar datos inciertos.

## Validación y límites

Reglas y SQL local, función con servicios simulados, navegador con los tres PDF y compilación. ALIHEN no está desplegado: falta acceso administrativo/red y secreto GPT. Las pruebas locales no demuestran funcionamiento productivo de esos servicios.
