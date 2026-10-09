# Arquitectura

HTML/CSS/JavaScript original con módulos ES y Vite. Node ≥22.13 y pnpm v11. Supabase Auth, PostgreSQL, Storage privado y Edge Functions. OpenAI Responses API con gpt-4.1-mini y esquema JSON estricto.

app.js conserva el gestor. collections-core.js contiene reglas de cobro y validación. collections-ui.js coordina pagos, revisión y sincronización. cloud.js conecta con Supabase mediante clave pública y sesión. PDF.js se carga al importar y reconstruye texto por coordenadas; pdf-draft.js prellena etiquetas explícitas. GPT interpreta el PDF digital o escaneado desde el servidor.

Modo local: localStorage e IndexedDB. Modo nube: caché separada por usuario, RPC transaccional y revisión de concurrencia. Los fallos no se presentan como guardados: se conserva una copia y se permite reintentar. Los datos del PDF se escapan al mostrarlos y el prompt ignora instrucciones internas del documento.

Usar el checkout aislado existente /workspace/practicas-clase; no crear worktrees salvo solicitud expresa. Los procesos deben arrancarse de nuevo en cada tarea. dist/ se publica en alojamiento estático. No se ha desplegado la web ni la función en ALIHEN.
