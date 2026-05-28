import { initContract } from '@ts-rest/core'
import { healthContract } from './v1/health'
import { appsContract } from './v1/apps'
import { meContract } from './v1/me'
import { localesContract } from './v1/locales'
import { adminTodoContract } from './v1/admin/todo'

const c = initContract()

export const apiContract = c.router({
  health: healthContract,
  apps: appsContract,
  me: meContract,
  locales: localesContract,
  admin: c.router({
    apps: c.router({
      todo: adminTodoContract,
    }),
  }),
})
