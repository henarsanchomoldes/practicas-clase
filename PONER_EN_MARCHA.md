# Activar el módulo en ALIHEN

La interfaz y el código están preparados. La clave pública conecta la aplicación, pero no crea tablas ni despliega funciones. Esta sesión no dispone de herramientas de administración de Supabase y el entorno bloquea las conexiones al proyecto por su política de red.

## 1. Conservar tus datos

En el gestor original del Mac: Empresa → Exportar copia. Conservar el JSON, los PDF originales y la carpeta antigua.

## 2. Crear tablas y almacenamiento

En el proyecto ALIHEN (gvfaalewopmpwihrbzyx), abrir SQL Editor y ejecutar una sola vez el contenido completo de:

`supabase/migrations/20261009100000_alihen_collections.sql`

Crea tablas alihen_, funciones y el bucket privado alihen-invoices. Si esos nombres ya existen, revisar la instalación previa; no borrar tablas para repetirlo. Mantener RLS y el bucket privado.

## 3. Crear tu usuario

En Authentication → Users, añadir un usuario con email y contraseña mediante el panel seguro de Supabase. Esta cuenta es distinta de la del dashboard. No enviar la contraseña por chat. Esta fase incluye inicio de sesión, pero no registro abierto ni recuperación de contraseña.

## 4. Desplegar la función GPT

En Edge Functions, crear extract-invoice y añadir en su editor estos archivos:

- index.ts: contenido de supabase/functions/extract-invoice/index.ts.
- schema.ts: contenido de supabase/functions/extract-invoice/schema.ts.

Desplegarla. Configurar Verify JWT del gateway como desactivado: la función valida cada usuario con auth.getUser y comprueba la propiedad del documento. Esto admite las claves públicas actuales sin dejar el endpoint sin autenticación.

Alternativa con CLI en un equipo autorizado:

```bash
supabase link --project-ref gvfaalewopmpwihrbzyx
supabase db push
supabase functions deploy extract-invoice --no-verify-jwt
```

La CLI sustituye los pasos del editor, no se ejecuta encima de una migración aplicada manualmente sin registrar su historial.

## 5. Configurar secretos

En Edge Functions → Secrets:

| Nombre | Valor |
|---|---|
| GPT_API_KEY | Tu clave privada de API de OpenAI con saldo, introducida allí de forma segura. |
| ALLOWED_ORIGIN | Origen exacto de la web, sin ruta ni barra final. |
| GPT_MODEL | Opcional; gpt-4.1-mini por defecto. |

Para el servidor de desarrollo predeterminado el origen es http://localhost:5173. Si utilizas otro puerto o una web publicada, usar ese origen exacto. La clave de OpenAI no se introduce en el chat ni en el navegador. Supabase proporciona sus variables internas SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.

## 6. Abrir la nueva aplicación

El ZIP contiene web/ compilada y codigo/ con las fuentes. Se puede subir web/ a un alojamiento estático. No abrir su index.html mediante doble clic: necesita HTTP/HTTPS.

Para desarrollar en tu Mac, abrir Terminal desde Spotlight y entrar en codigo/. Con Node.js y pnpm v11 instalados:

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# ALIHEN ya está configurado con su URL y clave pública.
pnpm dev
```

Abrir en el navegador la dirección que indique el servidor. Importar el JSON exportado del gestor anterior. En Empresa iniciar sesión y pulsar Importar esta copia a ALIHEN si la cuenta está vacía.

## 7. Comprobar el funcionamiento real

Importar un PDF, pulsar Extraer con GPT, revisar campos e importes y confirmar. Verificar factura en alihen_invoices y documento en el bucket privado. Registrar un pago parcial y después el resto, comprobar alertas y recargar. Comprobar que una segunda cuenta no puede leer los datos ni el PDF de la primera.

## Entorno de Codex

Se ha guardado en su borrador la autorización para gvfaalewopmpwihrbzyx.supabase.co. Guardar el cambio en ajustes y publicar el entorno para activarlo. Ese paso no crea tablas ni despliega la función.
