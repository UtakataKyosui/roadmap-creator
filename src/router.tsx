import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createQueryClient } from "./api/query-client";
import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";

export function getRouter() {
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}
