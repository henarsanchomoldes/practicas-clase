# Recuperar acceso rápido a Marcar pagada

**Fecha:** 2026-10-09 16:00
**Tipo:** Fix

## Qué se hizo
Restaurado el botón Marcar pagada en facturas con saldo. Abre la confirmación del cobro completo y permite introducir la fecha real. Comprobada la importación de la copia privada del gestor anterior, conservando sus estados y alertas.

## Qué se modificó
app.js, collections-ui.js, tests/browser/collections.spec.js, docs/user-flows.md y entregas.

## Por qué
El nuevo historial de cobros había sustituido el acceso rápido habitual. Los datos guardados en el navegador del gestor antiguo necesitan importarse mediante su JSON, y no están incluidos en el ZIP de código.
