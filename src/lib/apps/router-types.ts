export interface HandlerContext {
  groupId: string
  groupSlug: string
  userId?: string
}

export type RouteHandler = (req: Request, ctx: HandlerContext) => Promise<Response> | Response
