import { generateOpenApi } from '@ts-rest/open-api'
import { writeFileSync } from 'fs'
import { apiContract } from '../contracts'

const openApiDocument = generateOpenApi(apiContract, {
  info: {
    title: '027apps API',
    version: '1.0.0',
    description: 'API pública de 027apps',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://027app-eric-rf.vercel.app', description: 'Production' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
    },
  },
})

writeFileSync('public/openapi.json', JSON.stringify(openApiDocument, null, 2))
