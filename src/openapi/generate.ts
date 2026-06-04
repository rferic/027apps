import { generateOpenApi } from '@ts-rest/open-api'
import { writeFileSync } from 'fs'
import { apiContract } from '../contracts'

const JWT_OR_API_KEY_PATHS = ['/api/v1/apps']
const JWT_ONLY_PATHS = [
  '/api/v1/me', '/api/v1/admin/apps/todo',
  '/api/v1/admin/users', '/api/v1/admin/users/{id}',
  '/api/v1/admin/invitations', '/api/v1/admin/invitations/{id}',
  '/api/v1/admin/settings',
  '/api/v1/admin/api-keys', '/api/v1/admin/api-keys/{id}',
  '/api/v1/shared/profile', '/api/v1/shared/config',
]
const ADMIN_PATHS = [
  '/api/v1/admin/apps/todo',
  '/api/v1/admin/users', '/api/v1/admin/users/{id}',
  '/api/v1/admin/invitations', '/api/v1/admin/invitations/{id}',
  '/api/v1/admin/settings',
  '/api/v1/admin/api-keys', '/api/v1/admin/api-keys/{id}',
]

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
      url: 'https://027apps-eric-rf.vercel.app',
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

// ── Manual paths for Route Handler endpoints (not ts-rest contracts) ──

const paths = openApiDocument.paths as Record<string, Record<string, unknown>>

const bearerOnly = [{ bearerAuth: [] }]

paths['/api/v1/admin/users'] = {
  get: {
    tags: ['Admin - Users'],
    summary: 'List users',
    description: 'Returns a paginated list of users in the group. Requires admin role.',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 500 } },
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter by email or display name' },
    ],
    responses: {
      '200': { description: 'Paginated user list' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/users/{id}'] = {
  get: {
    tags: ['Admin - Users'],
    summary: 'Get user detail',
    description: 'Returns a single user\'s details. Requires admin role.',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'User UUID' },
    ],
    responses: {
      '200': { description: 'User detail' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '404': { description: 'User not found' },
    },
    security: bearerOnly,
  },
  put: {
    tags: ['Admin - Users'],
    summary: 'Update user',
    description: 'Update a user\'s role, profile, or block status. Requires admin role.',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'User UUID' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['admin', 'member'], description: 'User role' },
              display_name: { type: 'string', description: 'Display name' },
              locale: { type: 'string', description: 'Preferred locale (e.g. en, es)' },
              blocked: { type: 'boolean', description: 'Whether the user is blocked' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'User updated' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '404': { description: 'User not found' },
    },
    security: bearerOnly,
  },
  delete: {
    tags: ['Admin - Users'],
    summary: 'Delete user',
    description: 'Permanently removes a user from the group. Requires admin role. Returns 204 on success.',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'User UUID' },
    ],
    responses: {
      '204': { description: 'No Content — deleted successfully' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '404': { description: 'User not found' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/invitations'] = {
  get: {
    tags: ['Admin - Invitations'],
    summary: 'List invitations',
    description: 'Returns a paginated list of invitations. Requires admin role.',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 500 } },
    ],
    responses: {
      '200': { description: 'Paginated invitation list' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
    },
    security: bearerOnly,
  },
  post: {
    tags: ['Admin - Invitations'],
    summary: 'Create invitation',
    description: 'Creates a new invitation link/code. Requires admin role.',
    responses: {
      '201': { description: 'Invitation created' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '422': { description: 'Validation error' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/invitations/{id}'] = {
  delete: {
    tags: ['Admin - Invitations'],
    summary: 'Delete invitation',
    description: 'Deletes an invitation. Requires admin role. Returns 204 on success.',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Invitation UUID' },
    ],
    responses: {
      '204': { description: 'No Content — deleted successfully' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '404': { description: 'Invitation not found' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/settings'] = {
  get: {
    tags: ['Admin - Settings'],
    summary: 'Get group settings',
    description: 'Returns the group settings. Requires admin role.',
    responses: {
      '200': { description: 'Group settings' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
    },
    security: bearerOnly,
  },
  put: {
    tags: ['Admin - Settings'],
    summary: 'Update group settings',
    description: 'Updates group settings. Requires admin role.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              group_name: { type: 'string', description: 'Group display name' },
              default_locale: { type: 'string', description: 'Default locale for the group (e.g. en, es)' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Settings updated' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/api-keys'] = {
  get: {
    tags: ['Admin - API Keys'],
    summary: 'List API keys',
    description: 'Returns a paginated list of API keys (masked values). Requires admin role.',
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 500 } },
    ],
    responses: {
      '200': { description: 'Paginated API key list' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
    },
    security: bearerOnly,
  },
  post: {
    tags: ['Admin - API Keys'],
    summary: 'Create API key',
    description: 'Creates a new API key. The full key is returned only once in the response. Requires admin role.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Label for the API key' },
            },
            required: ['name'],
          },
        },
      },
    },
    responses: {
      '201': { description: 'API key created (full key returned once)' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '422': { description: 'Validation error' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/admin/api-keys/{id}'] = {
  delete: {
    tags: ['Admin - API Keys'],
    summary: 'Revoke API key',
    description: 'Revokes an API key. Requires admin role. Returns 204 on success.',
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'API key UUID' },
    ],
    responses: {
      '204': { description: 'No Content — revoked successfully' },
      '401': { description: 'Unauthorized' },
      '403': { description: 'Forbidden — admin role required' },
      '404': { description: 'API key not found' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/shared/profile'] = {
  get: {
    tags: ['Shared'],
    summary: 'Get authenticated user profile',
    description: 'Returns the authenticated user\'s profile.',
    responses: {
      '200': { description: 'User profile' },
      '401': { description: 'Unauthorized' },
    },
    security: bearerOnly,
  },
  put: {
    tags: ['Shared'],
    summary: 'Update own profile',
    description: 'Updates the authenticated user\'s own profile.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              display_name: { type: 'string', description: 'Display name' },
              locale: { type: 'string', description: 'Preferred locale (e.g. en, es)' },
              avatar_url: { type: 'string', description: 'Avatar image URL' },
            },
          },
        },
      },
    },
    responses: {
      '200': { description: 'Profile updated' },
      '401': { description: 'Unauthorized' },
    },
    security: bearerOnly,
  },
}

paths['/api/v1/shared/config'] = {
  get: {
    tags: ['Shared'],
    summary: 'Get group public config',
    description: 'Returns the group\'s public configuration (name, default locale, enabled features, etc.).',
    responses: {
      '200': { description: 'Group public config' },
      '401': { description: 'Unauthorized' },
    },
    security: bearerOnly,
  },
}

// ── New tags ──

if (!openApiDocument.tags) (openApiDocument as Record<string, unknown>).tags = []
const tags = (openApiDocument as Record<string, unknown>).tags as Array<{ name: string; description: string }>
const newTags = [
  { name: 'Admin - Users', description: 'User management (admin only)' },
  { name: 'Admin - Invitations', description: 'Invitation management (admin only)' },
  { name: 'Admin - Settings', description: 'Group settings (admin only)' },
  { name: 'Admin - API Keys', description: 'API key management (admin only)' },
  { name: 'Shared', description: 'Endpoints available to all authenticated group members' },
]
for (const tag of newTags) {
  if (!tags.some(t => t.name === tag.name)) {
    tags.push(tag)
  }
}

writeFileSync('public/openapi.json', JSON.stringify(openApiDocument, null, 2))
