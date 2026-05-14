import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { convex, isConvexEnabled } from "@/integrations/convex/client";
import { anyApi } from "convex/server";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConvexEnabled || !convex) {
      toast.error("Admin login membutuhkan Convex (VITE_CONVEX_URL).");
      return;
    }
    try {
      const res = await convex.mutation(anyApi.admin.login, { password });
      sessionStorage.setItem("siskeudes_admin_token", (res as any).token);
      sessionStorage.setItem("siskeudes_admin", "true");
      toast.success("Login admin berhasil");
      navigate("/admin/dashboard");
    } catch (err) {
      const anyErr = err as any;
      const data = anyErr?.data;
      const msg =
        (typeof data === "string" && data) ||
        (data && typeof data === "object" && typeof data.message === "string" && data.message) ||
        (typeof anyErr?.message === "string" && anyErr.message) ||
        "Admin login gagal.";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(152,40%,14%)] to-[hsl(152,35%,22%)]">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Masukkan password untuk mengakses panel admin</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password Admin</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2">
              <Lock size={16} /> Masuk
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              ← Kembali ke halaman utama
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
