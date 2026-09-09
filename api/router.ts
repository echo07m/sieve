import { adminRouter } from "./adminRouter";
import { analyticsRouter } from "./analyticsRouter";
import { apiKeysRouter } from "./apiKeysRouter";
import { authRouter } from "./auth-router";
import { billingRouter } from "./billingRouter";
import { copyrightRouter } from "./copyrightRouter";
import { customRulesRouter } from "./customRulesRouter";
import { deliveryRouter } from "./deliveryRouter";
import { filingRouter } from "./filingRouter";
import { leadsRouter } from "./leadsRouter";
import { markingRouter } from "./markingRouter";
import { ordersRouter } from "./ordersRouter";
import { notificationsRouter } from "./notificationsRouter";
import { publicToolsRouter } from "./publicToolsRouter";
import { createRouter, publicQuery } from "./middleware";
import { platformsRouter } from "./platformsRouter";
import { policyRouter } from "./policyRouter";
import { precedentRouter } from "./precedentRouter";
import { remediateRouter } from "./remediateRouter";
import { rulesRouter } from "./rulesRouter";
import { submissionsRouter } from "./submissionsRouter";
import { webhooksRouter } from "./webhooksRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  rules: rulesRouter,
  submissions: submissionsRouter,
  filing: filingRouter,
  copyright: copyrightRouter,
  apiKeys: apiKeysRouter,
  analytics: analyticsRouter,
  platforms: platformsRouter,
  delivery: deliveryRouter,
  marking: markingRouter,
  customRules: customRulesRouter,
  billing: billingRouter,
  leads: leadsRouter,
  admin: adminRouter,
  orders: ordersRouter,
  notifications: notificationsRouter,
  tools: publicToolsRouter,
  precedents: precedentRouter,
  remediate: remediateRouter,
  webhooks: webhooksRouter,
  policy: policyRouter,
});

export type AppRouter = typeof appRouter;
