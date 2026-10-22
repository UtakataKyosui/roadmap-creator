import { createServerFn } from "@tanstack/react-start";
import { env } from "void/env";

const defaultOrigin = "http://localhost:3000";

// 公開URLのオリジン。メタタグの絶対URL（og:image など）に使う。
// workerdでは process.env に値が入らないため、void/env 経由で API_ORIGIN を読む。
export const getSiteOrigin = createServerFn({ method: "GET" }).handler(
  async (): Promise<string> => {
    try {
      return new URL((env as { API_ORIGIN?: string }).API_ORIGIN ?? defaultOrigin).origin;
    } catch {
      return defaultOrigin;
    }
  },
);
