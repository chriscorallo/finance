"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Plus, Eye, EyeOff, RefreshCw, CircleCheck, LogOut, Sun, Moon, Laptop, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { usePrivacyMode } from "@/components/privacy/privacy-mode-provider";
import { signOutAction } from "@/app/(app)/sign-out-action";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function Topbar({ userEmail }: { userEmail: string }) {
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-2 sm:px-4">
      <MobileNav />

      <Button
        variant="outline"
        size="icon"
        className="shrink-0 text-muted-foreground sm:hidden"
        aria-label="Search"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="size-4" aria-hidden="true" />
      </Button>

      <Button
        variant="outline"
        className="hidden min-w-0 flex-1 justify-start gap-2 text-muted-foreground sm:flex sm:w-64 sm:flex-none"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Search…</span>
      </Button>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Global search across accounts, transactions, and bills arrives once those features ship.
            </DialogDescription>
          </DialogHeader>
          <Input placeholder="Search…" disabled />
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label="Quick add">
              <Plus className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Quick add</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Manual transaction (coming soon)</DropdownMenuItem>
          <DropdownMenuItem disabled>Manual account (coming soon)</DropdownMenuItem>
          <DropdownMenuItem disabled>Goal (coming soon)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-xs text-muted-foreground sm:px-2">
                <CircleCheck className="size-3.5 shrink-0 text-positive" aria-hidden="true" />
                <span className="hidden md:inline">No accounts connected</span>
              </span>
            }
          />
          <TooltipContent>Connect an institution to see sync status here.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Data health" disabled className="hidden sm:inline-flex">
                <RefreshCw className="size-4" />
              </Button>
            }
          />
          <TooltipContent>Data-quality health score arrives with account syncing.</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={privacyMode}
                aria-label={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
                onClick={togglePrivacyMode}
              >
                {privacyMode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            }
          />
          <TooltipContent>{privacyMode ? "Privacy mode on — click to show amounts" : "Privacy mode — blur amounts"}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Toggle theme">
                {theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Laptop className="size-4" />}
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Account menu">
                <UserRound className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="max-w-56 truncate font-normal text-muted-foreground">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings/security">Security</Link>} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOutAction()} variant="destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="hidden gap-2 pl-2 pr-3 sm:flex">
                <span className="max-w-40 truncate text-sm">{userEmail}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/settings/security">Security</Link>} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOutAction()} variant="destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
