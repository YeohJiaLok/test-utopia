"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import type { SessionUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { clearCopilot } from "@/components/ai/use-copilot";
import { MfaSheet } from "./mfa-sheet";

const ROLE_LABEL = { admin: "Admin", technician: "Technician", manager: "Manager" } as const;

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "bg-gradient-brand flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function UserMenu({ user, compact }: { user: SessionUser; compact?: boolean }) {
  const { setTheme, theme } = useTheme();
  const [pending, start] = useTransition();
  const [mfaOpen, setMfaOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "hover:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors",
            compact && "w-auto",
            pending && "opacity-60",
          )}
        >
          <UserAvatar name={user.fullName} />
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.fullName}</span>
                <span className="text-muted-foreground block truncate text-xs">{ROLE_LABEL[user.role]}</span>
              </span>
              <ChevronsUpDown className="text-muted-foreground size-4" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side={compact ? "bottom" : "top"} className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="block text-sm font-medium text-foreground">{user.fullName}</span>
              <span className="text-muted-foreground block text-xs font-normal">{user.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Security</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setMfaOpen(true)}>
              <ShieldCheck /> Two-factor authentication
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === "dark" ? <Moon /> : theme === "system" ? <Monitor /> : <Sun />} Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor /> System
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => {
              clearCopilot(); // no conversation survives sign-out
              start(() => logoutAction());
            }}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MfaSheet open={mfaOpen} onOpenChange={setMfaOpen} />
    </>
  );
}
