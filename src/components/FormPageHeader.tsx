import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session-manager";
import { isConvexEnabled } from "@/integrations/convex/client";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

interface FormPageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

interface GroupInfo {
  groupName: string;
  members: { user_name: string; is_leader: boolean; session_id: string }[];
}

export default function FormPageHeader({ title, subtitle, children }: FormPageHeaderProps) {
  return isConvexEnabled ? (
    <FormPageHeaderConvex title={title} subtitle={subtitle}>{children}</FormPageHeaderConvex>
  ) : (
    <FormPageHeaderSupabase title={title} subtitle={subtitle}>{children}</FormPageHeaderSupabase>
  );
}

function FormPageHeaderConvex({ title, subtitle, children }: FormPageHeaderProps) {
  const navigate = useNavigate();
  const sessionId = getSessionId();

  const desaProfile = (() => {
    try {
      return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}");
    } catch {
      return {};
    }
  })();
  const villageName = desaProfile.namaDesa;

  const [groupId, setGroupId] = useState<string | null>(() => {
    try { return localStorage.getItem("siskeudes_group_id"); } catch { return null; }
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "siskeudes_group_id") {
        try { setGroupId(localStorage.getItem("siskeudes_group_id")); } catch { setGroupId(null); }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const group = useQuery(
    anyApi.groups.get,
    { groupId: (groupId || undefined) as never },
  ) as { name?: string } | null | undefined;

  const members = useQuery(
    anyApi.groups.members,
    { groupId: (groupId || undefined) as never },
  ) as GroupInfo["members"] | undefined;

  const groupInfo: GroupInfo | null =
    groupId && (group || members)
      ? {
          groupName: group?.name || "Kelompok",
          members: (members || []) as GroupInfo["members"],
        }
      : null;

  return (
    <div className="page-header flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold font-heading truncate">
          {title}
          {villageName ? ` — Desa ${villageName}` : ""}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}

        {groupInfo && groupInfo.members.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              <Users size={11} />
              {groupInfo.groupName}
              <span className="opacity-70">· {groupInfo.members.length} anggota</span>
            </span>
            <span className="inline-flex flex-wrap gap-1">
              {groupInfo.members.map((m) => {
                const isMe = m.session_id === sessionId;
                return (
                  <span
                    key={m.session_id}
                    className={`px-1.5 py-0.5 rounded border text-[10px] leading-tight ${
                      isMe
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border/60 bg-muted/40"
                    }`}
                    title={m.is_leader ? "Ketua kelompok" : "Anggota"}
                  >
                    {m.is_leader && <span className="mr-0.5">👑</span>}
                    {m.user_name || "—"}
                    {isMe && <span className="ml-1 opacity-60">(Anda)</span>}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {children}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          title="Tutup"
        >
          <X size={18} />
        </Button>
      </div>
    </div>
  );
}

function FormPageHeaderSupabase({ title, subtitle, children }: FormPageHeaderProps) {
  const navigate = useNavigate();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const sessionId = getSessionId();

  const desaProfile = (() => {
    try {
      return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}");
    } catch {
      return {};
    }
  })();
  const villageName = desaProfile.namaDesa;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const groupId = localStorage.getItem("siskeudes_group_id");
      if (!groupId) {
        if (!cancelled) setGroupInfo(null);
        return;
      }
      if (!isSupabaseEnabled || !supabase) {
        if (!cancelled) setGroupInfo(null);
        return;
      }
      const [{ data: g }, { data: m }] = await Promise.all([
        supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
        supabase
          .from("group_members")
          .select("user_name, is_leader, session_id")
          .eq("group_id", groupId)
          .order("joined_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setGroupInfo({
        groupName: (g?.name as string) || "Kelompok",
        members: (m || []) as GroupInfo["members"],
      });
    };

    load();

    const groupId = localStorage.getItem("siskeudes_group_id");
    if (!groupId) return () => { cancelled = true; };
    if (!isSupabaseEnabled || !supabase) return () => { cancelled = true; };

    const channel = supabase
      .channel(`form-header-group-${groupId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="page-header flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold font-heading truncate">
          {title}
          {villageName ? ` — Desa ${villageName}` : ""}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}

        {groupInfo && groupInfo.members.length > 0 && (
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              <Users size={11} />
              {groupInfo.groupName}
              <span className="opacity-70">· {groupInfo.members.length} anggota</span>
            </span>
            <span className="inline-flex flex-wrap gap-1">
              {groupInfo.members.map((m) => {
                const isMe = m.session_id === sessionId;
                return (
                  <span
                    key={m.session_id}
                    className={`px-1.5 py-0.5 rounded border text-[10px] leading-tight ${
                      isMe
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border/60 bg-muted/40"
                    }`}
                    title={m.is_leader ? "Ketua kelompok" : "Anggota"}
                  >
                    {m.is_leader && <span className="mr-0.5">👑</span>}
                    {m.user_name || "—"}
                    {isMe && <span className="ml-1 opacity-60">(Anda)</span>}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {children}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          title="Tutup"
        >
          <X size={18} />
        </Button>
      </div>
    </div>
  );
}
