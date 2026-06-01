import { generateOpenApi } from '@ts-rest/open-api'
import { writeFileSync } from 'fs'
import { apiContract } from '../contracts'

const JWT_OR_API_KEY_PATHS = ['/api/v1/apps']
const JWT_ONLY_PATHS = ['/api/v1/me', '/api/v1/admin/apps/todo']
const ADMIN_PATHS = ['/api/v1/admin/apps/todo']

const openApiDocument = generateOpenApi(apiContract, {
  info: {
    title: '027Apps API',
    version: '1.0.0',
    description: `# 027Apps API

API pública de la plataforma 027Apps — espacio compartido para aplicaciones, tareas y herramientas entre grupos.

## Autenticación

La API soporta dos métodos de autenticación:

- **JWT Bearer Token** (recomendado): obtenido al iniciar sesión. Enviar como \`Authorization: Bearer <token>\`.
- **API Key**: para acceso de servidor a servidor. Enviar como \`X-API-Key: <key>\`.

## Estados de respuesta

| Código | Significado |
|--------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

## Notas

- Todos los endpoints que requieren autenticación devuelven \`401\` si falta el token.
- Los endpoints de administración requieren rol \`admin\`.
- Los endpoints de apps dinámicas (proxy) no están documentados aquí por ser específicos de cada app instalada.`,
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
    {
      url: 'https://027app-eric-rf.vercel.app',
      description: 'Production',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtenido al iniciar sesión en la aplicación',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key generada desde el panel de administración',
      },
    },
  },
})

// Add security requirement to protected paths
for (const [path, methods] of Object.entries(openApiDocument.paths)) {
  const methodEntries = methods as Record<string, unknown>
  for (const method of Object.values(methodEntries)) {
    const def = method as Record<string, unknown>
    if (JWT_OR_API_KEY_PATHS.includes(path)) {
      def.security = [{ bearerAuth: [] }, { apiKey: [] }]
    } else if (JWT_ONLY_PATHS.includes(path)) {
      def.security = [{ bearerAuth: [] }]
    }
    if (ADMIN_PATHS.includes(path)) {
      def.tags = [...new Set([...(def.tags as string[] || []), 'Admin'])]
    }
  }
}

writeFileSync('public/openapi.json', JSON.stringify(openApiDocument, null, 2))
