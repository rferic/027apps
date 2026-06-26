import { initContract } from '@ts-rest/core'
import { healthContract } from './v1/health'
import { appsContract } from './v1/apps'
import { meContract } from './v1/me'
import { localesContract } from './v1/locales'
import { mobileContract, versionContract } from './v1/mobile'
import { notificationsContract } from './v1/notifications'
import { adminTodoContract } from './v1/admin/todo'

const c = initContract()

export const apiContract = c.router({
  health: healthContract,
  apps: appsContract,
  me: meContract,
  locales: localesContract,
  mobile: mobileContract,
  version: versionContract,
  notifications: notificationsContract,
  admin: c.router({
    apps: c.router({
      todo: adminTodoContract,
    }),
  }),
})
