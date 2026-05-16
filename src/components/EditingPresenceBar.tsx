import { useEditingPresence, getModuleDisplayName } from "@/hooks/use-editing-presence";
import { useGroupContext } from "@/hooks/use-group-context";
import { Edit3 } from "lucide-react";

/**
 * Compact bar showing who else is editing in the same group.
 * Only renders when in group mode and others are actively editing.
 */
export default function EditingPresenceBar() {
  const { groupId, workMode } = useGroupContext();
  const { presence } = useEditingPresence();

  if (!groupId || workMode !== "group") return null;
  if (!presence || presence.length === 0) return null;

  return (
    <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1.5 flex items-center gap-2 text-xs text-blue-300 overflow-x-auto">
      <Edit3 size={12} className="shrink-0 opacity-70" />
      <div className="flex items-center gap-3 flex-wrap">
        {presence.map((p) => (
          <span key={p.sessionId} className="whitespace-nowrap">
            <span className="font-medium">{p.userName || "User"}</span>
            {" sedang edit "}
            <span className="font-medium">{getModuleDisplayName(p.module)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
