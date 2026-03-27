import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export interface TeamMember {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type SelectedChat = { type: "group" } | { type: "dm"; userId: string };

interface Props {
  members: TeamMember[];
  currentUserId: string | null;
  selectedChat: SelectedChat;
  onSelect: (chat: SelectedChat) => void;
  onlineUserIds?: Set<string>;
}

export function TeamMembersList({ members, currentUserId, selectedChat, onSelect, onlineUserIds = new Set() }: Props) {
  const otherMembers = members.filter((m) => m.user_id !== currentUserId);
  const onlineCount = members.filter((m) => onlineUserIds.has(m.user_id)).length;

  return (
    <div className="flex flex-col gap-1">
      {/* Group chat option */}
      <button
        onClick={() => onSelect({ type: "group" })}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
          selectedChat.type === "group"
            ? "bg-primary/15 text-primary"
            : "hover:bg-muted/50 text-muted-foreground"
        )}
      >
        <div className="flex items-center justify-center size-9 rounded-full bg-primary/10">
          <Users className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Grupo da Equipe</p>
          <p className="text-[10px] text-muted-foreground">
            {members.length} membros · <span className="text-green-500">{onlineCount} online</span>
          </p>
        </div>
      </button>

      <div className="h-px bg-border my-2" />
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-3 mb-1">
        Mensagens Diretas
      </p>

      {otherMembers.map((member) => {
        const isSelected = selectedChat.type === "dm" && selectedChat.userId === member.user_id;
        const initial = (member.full_name || "?").charAt(0).toUpperCase();
        const isOnline = onlineUserIds.has(member.user_id);

        return (
          <button
            key={member.user_id}
            onClick={() => onSelect({ type: "dm", userId: member.user_id })}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left",
              isSelected
                ? "bg-primary/15 text-primary"
                : "hover:bg-muted/50 text-muted-foreground"
            )}
          >
            <div className="relative">
              <Avatar className="size-8">
                <AvatarImage src={member.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
                  isOnline ? "bg-green-500" : "bg-muted-foreground/40"
                )}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{member.full_name || "Membro"}</p>
              <p className={cn("text-[10px]", isOnline ? "text-green-500" : "text-muted-foreground")}>
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
          </button>
        );
      })}

      {otherMembers.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2">Nenhum outro membro</p>
      )}
    </div>
  );
}
