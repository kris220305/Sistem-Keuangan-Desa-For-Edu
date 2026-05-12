import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const channelObj: any = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    isSupabaseEnabled: true,
    supabase: {
      channel: vi.fn(() => channelObj),
      removeChannel: vi.fn(async () => {}),
    },
  };
});

describe("use-group-realtime-sync subscriptions", () => {
  it("menggunakan singleton subscription per groupId + refCount", async () => {
    const mod = await import("@/hooks/use-group-realtime-sync");
    const { supabase } = await import("@/integrations/supabase/client");

    mod._test.activeSubscriptions.clear();
    const unsub1 = mod._test.subscribeSupabaseGroup("g1", "s1");
    const unsub2 = mod._test.subscribeSupabaseGroup("g1", "s1");

    expect((supabase as any).channel).toHaveBeenCalledTimes(1);
    expect(mod._test.activeSubscriptions.size).toBe(1);

    unsub1();
    expect(mod._test.activeSubscriptions.size).toBe(1);
    expect((supabase as any).removeChannel).toHaveBeenCalledTimes(0);

    unsub2();
    expect(mod._test.activeSubscriptions.size).toBe(0);
    expect((supabase as any).removeChannel).toHaveBeenCalledTimes(1);
  }, 15000);
});
