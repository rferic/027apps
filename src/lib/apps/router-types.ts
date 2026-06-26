export interface HandlerContext {
  groupId: string
  groupSlug: string
  userId: string
  role: 'admin' | 'member'
}

export type RouteHandler = (req: Request, ctx: HandlerContext) => Promise<Response> | Response
