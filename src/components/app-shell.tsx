"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { DbSelector, type DatabaseInfo } from "@/components/db-selector";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
  databases?: DatabaseInfo[];
  selectedDatabase?: string;
  onDatabaseSelect?: (name: string) => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/databases": "Bancos de Dados",
  "/monitoring": "Monitoramento",
  "/logs": "Logs",
  "/commands": "Comandos SQL",
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href?: string }[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const title = pageTitles[currentPath] || decodeURIComponent(segment);
    breadcrumbs.push({ label: title, href: currentPath });
  }

  return breadcrumbs;
}

export function AppShell({
  children,
  databases,
  selectedDatabase,
  onDatabaseSelect,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const breadcrumbs = getBreadcrumbs(pathname);

  const showDbSelector =
    databases &&
    databases.length > 0 &&
    (pathname.startsWith("/databases") || pathname.startsWith("/monitoring"));

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main content area */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          sidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-1.5 pl-12 text-sm md:pl-0">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href || index}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    index === breadcrumbs.length - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Right: DB selector + User menu */}
          <div className="flex items-center gap-3">
            {showDbSelector && (
              <DbSelector
                databases={databases}
                selected={selectedDatabase}
                onSelect={onDatabaseSelect || (() => {})}
              />
            )}

            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="hidden text-sm text-muted-foreground md:inline">
                {session?.user?.name || session?.user?.email || "Usuario"}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
