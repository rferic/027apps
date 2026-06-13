import todoGetHandler from '../../../apps/todo/routes/GET'
import todoPostHandler from '../../../apps/todo/routes/POST'
import todoItemGetHandler from '../../../apps/todo/routes/[id]/GET'
import todoItemPutHandler from '../../../apps/todo/routes/[id]/PUT'
import todoItemDeleteHandler from '../../../apps/todo/routes/[id]/DELETE'

import inspGetHandler from '../../../apps/inspiration/routes/GET'
import inspPostHandler from '../../../apps/inspiration/routes/POST'
import inspPutHandler from '../../../apps/inspiration/routes/[id]/PUT'
import inspDeleteHandler from '../../../apps/inspiration/routes/[id]/DELETE'
import inspCommentsGetHandler from '../../../apps/inspiration/routes/[id]/comments/GET'
import inspCommentsPostHandler from '../../../apps/inspiration/routes/[id]/comments/POST'
import inspVoteHandler from '../../../apps/inspiration/routes/[id]/vote'
import inspAppsGetHandler from '../../../apps/inspiration/routes/apps/GET'

import type { RouteHandler } from '@/lib/apps/router-types'

interface RouteEntry {
  method: string
  segments: string[]
  handler: RouteHandler
}

const DYNAMIC_SEGMENT_RE = /^\[.+\]$/

import todoCatGetHandler from '../../../apps/todo/routes/categories/GET'
import todoCatPostHandler from '../../../apps/todo/routes/categories/POST'
import todoCatPutHandler from '../../../apps/todo/routes/categories/[id]/PUT'
import todoCatDeleteHandler from '../../../apps/todo/routes/categories/[id]/DELETE'
import todoWidgetMyHandler from '../../../apps/todo/routes/widget/my/GET'
import todoWidgetGroupHandler from '../../../apps/todo/routes/widget/group/GET'
import todoNotifPrefsGetHandler from '../../../apps/todo/routes/notification-prefs/GET'
import todoNotifPrefsPutHandler from '../../../apps/todo/routes/notification-prefs/PUT'
import todoMembersHandler from '../../../apps/todo/routes/members/GET'

import seGroupsGetHandler from '../../../apps/split-expenses/routes/GET'
import seGroupsPostHandler from '../../../apps/split-expenses/routes/POST'
import seGroupGetHandler from '../../../apps/split-expenses/routes/[id]/GET'
import seGroupPutHandler from '../../../apps/split-expenses/routes/[id]/PUT'
import seGroupDeleteHandler from '../../../apps/split-expenses/routes/[id]/DELETE'
import seMembersGetHandler from '../../../apps/split-expenses/routes/[id]/members/GET'
import seMembersPostHandler from '../../../apps/split-expenses/routes/[id]/members/POST'
import seMemberPutHandler from '../../../apps/split-expenses/routes/[id]/members/[memberId]/PUT'
import seMemberDeleteHandler from '../../../apps/split-expenses/routes/[id]/members/[memberId]/DELETE'
import seExpensesGetHandler from '../../../apps/split-expenses/routes/[id]/expenses/GET'
import seExpensesPostHandler from '../../../apps/split-expenses/routes/[id]/expenses/POST'
import seExpenseGetHandler from '../../../apps/split-expenses/routes/[id]/expenses/[expenseId]/GET'
import seExpensePutHandler from '../../../apps/split-expenses/routes/[id]/expenses/[expenseId]/PUT'
import seExpenseDeleteHandler from '../../../apps/split-expenses/routes/[id]/expenses/[expenseId]/DELETE'
import seBalancesGetHandler from '../../../apps/split-expenses/routes/[id]/balances/GET'
import seSettlementsGetHandler from '../../../apps/split-expenses/routes/[id]/settlements/GET'
import seSettlementsPostHandler from '../../../apps/split-expenses/routes/[id]/settlements/POST'
import seSettlementGetHandler from '../../../apps/split-expenses/routes/[id]/settlements/[settlementId]/GET'
import seTagsGetHandler from '../../../apps/split-expenses/routes/[id]/tags/GET'
import seTagsPostHandler from '../../../apps/split-expenses/routes/[id]/tags/POST'
import seTagPutHandler from '../../../apps/split-expenses/routes/[id]/tags/[tagId]/PUT'
import seTagDeleteHandler from '../../../apps/split-expenses/routes/[id]/tags/[tagId]/DELETE'
import seStatsGetHandler from '../../../apps/split-expenses/routes/[id]/stats/GET'

const ROUTE_REGISTRY: Record<string, RouteEntry[]> = {
  todo: [
    { method: 'GET', segments: ['items'], handler: todoGetHandler },
    { method: 'POST', segments: ['items'], handler: todoPostHandler },
    { method: 'GET', segments: ['items', '[id]'], handler: todoItemGetHandler },
    { method: 'PUT', segments: ['items', '[id]'], handler: todoItemPutHandler },
    { method: 'DELETE', segments: ['items', '[id]'], handler: todoItemDeleteHandler },
    { method: 'GET', segments: ['categories'], handler: todoCatGetHandler },
    { method: 'POST', segments: ['categories'], handler: todoCatPostHandler },
    { method: 'PUT', segments: ['categories', '[id]'], handler: todoCatPutHandler },
    { method: 'DELETE', segments: ['categories', '[id]'], handler: todoCatDeleteHandler },
    { method: 'GET', segments: ['widget', 'my'], handler: todoWidgetMyHandler },
    { method: 'GET', segments: ['widget', 'group'], handler: todoWidgetGroupHandler },
    { method: 'GET', segments: ['notification-prefs'], handler: todoNotifPrefsGetHandler },
    { method: 'PUT', segments: ['notification-prefs'], handler: todoNotifPrefsPutHandler },
    { method: 'GET', segments: ['members'], handler: todoMembersHandler },
  ],
  inspiration: [
    { method: 'GET', segments: [], handler: inspGetHandler },
    { method: 'POST', segments: [], handler: inspPostHandler },
    { method: 'PUT', segments: ['[id]'], handler: inspPutHandler },
    { method: 'DELETE', segments: ['[id]'], handler: inspDeleteHandler },
    { method: 'GET', segments: ['apps'], handler: inspAppsGetHandler },
    { method: 'GET', segments: ['[id]', 'comments'], handler: inspCommentsGetHandler },
    { method: 'POST', segments: ['[id]', 'comments'], handler: inspCommentsPostHandler },
    { method: 'POST', segments: ['[id]', 'vote'], handler: inspVoteHandler },
  ],
  'split-expenses': [
    { method: 'GET', segments: [], handler: seGroupsGetHandler },
    { method: 'POST', segments: [], handler: seGroupsPostHandler },
    { method: 'GET', segments: ['[id]'], handler: seGroupGetHandler },
    { method: 'PUT', segments: ['[id]'], handler: seGroupPutHandler },
    { method: 'DELETE', segments: ['[id]'], handler: seGroupDeleteHandler },
    { method: 'GET', segments: ['[id]', 'members'], handler: seMembersGetHandler },
    { method: 'POST', segments: ['[id]', 'members'], handler: seMembersPostHandler },
    { method: 'PUT', segments: ['[id]', 'members', '[memberId]'], handler: seMemberPutHandler },
    { method: 'DELETE', segments: ['[id]', 'members', '[memberId]'], handler: seMemberDeleteHandler },
    { method: 'GET', segments: ['[id]', 'expenses'], handler: seExpensesGetHandler },
    { method: 'POST', segments: ['[id]', 'expenses'], handler: seExpensesPostHandler },
    { method: 'GET', segments: ['[id]', 'expenses', '[expenseId]'], handler: seExpenseGetHandler },
    { method: 'PUT', segments: ['[id]', 'expenses', '[expenseId]'], handler: seExpensePutHandler },
    { method: 'DELETE', segments: ['[id]', 'expenses', '[expenseId]'], handler: seExpenseDeleteHandler },
    { method: 'GET', segments: ['[id]', 'balances'], handler: seBalancesGetHandler },
    { method: 'GET', segments: ['[id]', 'settlements'], handler: seSettlementsGetHandler },
    { method: 'POST', segments: ['[id]', 'settlements'], handler: seSettlementsPostHandler },
    { method: 'GET', segments: ['[id]', 'settlements', '[settlementId]'], handler: seSettlementGetHandler },
    { method: 'GET', segments: ['[id]', 'tags'], handler: seTagsGetHandler },
    { method: 'POST', segments: ['[id]', 'tags'], handler: seTagsPostHandler },
    { method: 'PUT', segments: ['[id]', 'tags', '[tagId]'], handler: seTagPutHandler },
    { method: 'DELETE', segments: ['[id]', 'tags', '[tagId]'], handler: seTagDeleteHandler },
    { method: 'GET', segments: ['[id]', 'stats'], handler: seStatsGetHandler },
  ],
}

function matchSegments(pattern: string[], actual: string[]): boolean {
  if (pattern.length !== actual.length) return false
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] !== actual[i] && !DYNAMIC_SEGMENT_RE.test(pattern[i])) return false
  }
  return true
}

export function getAppRouteHandler(
  slug: string,
  method: string,
  segments: string[]
): RouteHandler | null {
  const routes = ROUTE_REGISTRY[slug]
  if (!routes) return null

  const entry = routes.find(e => e.method === method && matchSegments(e.segments, segments))
  return entry?.handler ?? null
}
