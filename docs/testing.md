# Validación

pnpm test: reglas de cobro, revisión de datos, lectura local y migración real en PostgreSQL local (PGlite). La Edge Function se ejecuta con Auth/Storage/OpenAI simulados para comprobar permisos, integridad, concurrencia y errores sin llamadas de pago.

pnpm test:e2e: Playwright con pagos, persistencia, anulaciones, HTML no confiable e integración Supabase simulada. Requiere variables públicas en .env.local para los casos de nube. ALIHEN_SAMPLE_DIR activa las tres pruebas de PDF privados aportados; sin ese directorio se omiten explícitamente. CHROMIUM_PATH permite utilizar un navegador ya instalado.

pnpm build genera producción. Después de cambios en empaquetado, comprobar el comportamiento con pnpm preview y los enlaces estáticos.

Pendiente: la red del entorno bloqueó ALIHEN y no hay acceso administrativo disponible. No se han aplicado tablas ni desplegado función, ni realizado una llamada real a GPT. Falta configurar GPT_API_KEY en Supabase. Las pruebas simuladas no validan los servicios externos. Los tres ejemplos son PDF digitales; aún falta probar un escaneado real.

Después de activar servicios, seguir el smoke test de PONER_EN_MARCHA.md: extracción, guardado, recarga, pago parcial/completo y aislamiento entre usuarios.

Resultado de esta sesión: 24 pruebas de reglas/SQL/extracción y 8 pruebas de navegador pasadas, incluidas las tres facturas privadas. Compilación de producción correcta. Servicios externos pendientes como se indica arriba.
