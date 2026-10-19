import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isHitKey, type HitKey } from "@/lib/hits";

export const recordHit = createServerFn({ method: "POST" })
  .validator((key: unknown): HitKey => {
    if (typeof key !== "string" || !isHitKey(key)) throw new Error("Unknown counter");
    return key;
  })
  .handler(async ({ data }) => {
    const { bumpHit } = await import("./admin.server");
    await bumpHit(data);
    return { ok: true as const };
  });

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { loadAdminDashboard } = await import("./admin.server");
    return loadAdminDashboard(context.userId);
  });
