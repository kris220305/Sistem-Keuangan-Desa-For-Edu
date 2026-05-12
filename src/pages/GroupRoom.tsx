import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseEnabled } from "@/integrations/supabase/client";
import { getGroupMembers, getSessionId } from "@/lib/session-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, User, Users, ArrowLeft } from "lucide-react";
import FormPageHeader from "@/components/FormPageHeader";
import { isConvexEnabled } from "@/integrations/convex/client";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";

interface GroupMember {
  id: string;
  session_id: string;
  user_name: string;
  is_leader: boolean;
  joined_at: string;
}

export default function GroupRoom() {
  return isConvexEnabled ? <GroupRoomConvex /> : <GroupRoomSupabase />;
}

function GroupRoomConvex() {
  const navigate = useNavigate();
  const groupId = localStorage.getItem("siskeudes_group_id");
  const currentSessionId = getSessionId();
  const [timedOut, setTimedOut] = useState(false);
  const villageName = (() => {
    try {
      return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}").namaDesa || "—";
    } catch { return "—"; }
  })();

  useEffect(() => {
    if (!groupId) navigate("/data-umum");
  }, [groupId, navigate]);

  const group = useQuery(
    anyApi.groups.get,
    { groupId: (groupId || undefined) as never },
  ) as { max_members?: number } | null | undefined;

  const members = useQuery(
    anyApi.groups.members,
    { groupId: (groupId || undefined) as never },
  ) as GroupMember[] | undefined;

  const loading = !members;
  useEffect(() => {
    setTimedOut(false);
    if (!groupId) return;
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [groupId, loading]);
  const max = group?.max_members ?? 50;
  const leader = (members || []).find((m) => m.is_leader);

  return (
    <div>
      <FormPageHeader
        title={`Room Kelompok — Desa ${villageName}`}
        subtitle={`${(members || []).length}/${max} anggota`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate("/data-umum")} className="gap-2">
          <ArrowLeft size={14} /> Kembali
        </Button>
      </FormPageHeader>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold">{(members || []).length}</p>
              <p className="text-xs text-muted-foreground">Anggota</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="mx-auto mb-2 text-yellow-500" size={24} />
              <p className="text-sm font-bold truncate">{leader?.user_name || "—"}</p>
              <p className="text-xs text-muted-foreground">Ketua Kelompok</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="mx-auto mb-2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{Math.max(0, max - (members || []).length)}</span>
              </div>
              <p className="text-sm font-bold">{Math.max(0, max - (members || []).length)} slot</p>
              <p className="text-xs text-muted-foreground">Tersisa</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={18} /> Daftar Anggota Kelompok
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm text-muted-foreground">Memuat...</p>
                {timedOut && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Masih lama memuat anggota kelompok.</div>
                    <div>
                      Pastikan VITE_CONVEX_URL sudah benar dan backend Convex sudah di-deploy.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(members || []).map((m, idx) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      m.session_id === currentSessionId
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      m.is_leader ? "bg-yellow-100 text-yellow-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {m.is_leader ? <Crown size={16} /> : <User size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{m.user_name || "—"}</span>
                        {m.is_leader && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-200">
                            Ketua
                          </Badge>
                        )}
                        {!m.is_leader && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            Anggota
                          </Badge>
                        )}
                        {m.session_id === currentSessionId && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary">
                            Anda
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>💡 Ketua kelompok dipilih otomatis dan dapat mengirim laporan ke admin.</p>
          <p>📋 Progress pengerjaan form akan otomatis tersinkronisasi antar anggota kelompok.</p>
        </div>
      </div>
    </div>
  );
}

function GroupRoomSupabase() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const groupId = localStorage.getItem("siskeudes_group_id");
  const currentSessionId = getSessionId();
  const villageName = (() => {
    try {
      return JSON.parse(localStorage.getItem("siskeudes_desa_profile") || "{}").namaDesa || "—";
    } catch { return "—"; }
  })();

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    const data = await getGroupMembers(groupId);
    setMembers(data as GroupMember[]);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      navigate("/data-umum");
      return;
    }
    if (!isSupabaseEnabled || !supabase) {
      setLoading(false);
      return;
    }
    loadMembers();

    const channel = supabase
      .channel(`group-room-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          void loadMembers();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, navigate, loadMembers]);

  const leader = members.find(m => m.is_leader);

  return (
    <div>
      <FormPageHeader title={`Room Kelompok — Desa ${villageName}`} subtitle={`${members.length}/10 anggota`}>
        <Button variant="outline" size="sm" onClick={() => navigate("/data-umum")} className="gap-2">
          <ArrowLeft size={14} /> Kembali
        </Button>
      </FormPageHeader>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-2xl font-bold">{members.length}</p>
              <p className="text-xs text-muted-foreground">Anggota</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Crown className="mx-auto mb-2 text-yellow-500" size={24} />
              <p className="text-sm font-bold truncate">{leader?.user_name || "—"}</p>
              <p className="text-xs text-muted-foreground">Ketua Kelompok</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="mx-auto mb-2 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{10 - members.length}</span>
              </div>
              <p className="text-sm font-bold">{10 - members.length} slot</p>
              <p className="text-xs text-muted-foreground">Tersisa</p>
            </CardContent>
          </Card>
        </div>

        {/* Member List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={18} /> Daftar Anggota Kelompok
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Memuat...</p>
            ) : (
              <div className="space-y-2">
                {members.map((m, idx) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      m.session_id === currentSessionId
                        ? "bg-primary/5 border-primary/30"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      m.is_leader ? "bg-yellow-100 text-yellow-600" : "bg-muted text-muted-foreground"
                    }`}>
                      {m.is_leader ? <Crown size={16} /> : <User size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{m.user_name || "—"}</span>
                        {m.is_leader && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-yellow-100 text-yellow-700 border-yellow-200">
                            Ketua
                          </Badge>
                        )}
                        {!m.is_leader && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            Anggota
                          </Badge>
                        )}
                        {m.session_id === currentSessionId && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary">
                            Anda
                          </Badge>
                        )}
                      </div>

                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">#{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>💡 Ketua kelompok dipilih secara acak dan dapat mengirim laporan keuangan ke admin.</p>
          <p>📋 Progress pengerjaan form akan otomatis tersinkronisasi antar anggota kelompok.</p>
        </div>
      </div>
    </div>
  );
}
