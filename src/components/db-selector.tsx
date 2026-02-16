"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export interface DatabaseInfo {
  name: string;
  status: "online" | "offline" | "unknown";
}

interface DbSelectorProps {
  databases: DatabaseInfo[];
  selected?: string;
  onSelect: (name: string) => void;
}

function StatusDot({ status }: { status: DatabaseInfo["status"] }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        status === "online" && "bg-emerald-500",
        status === "offline" && "bg-red-500",
        status === "unknown" && "bg-yellow-500"
      )}
      aria-label={
        status === "online"
          ? "Online"
          : status === "offline"
            ? "Offline"
            : "Desconhecido"
      }
    />
  );
}

export function DbSelector({ databases, selected, onSelect }: DbSelectorProps) {
  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="h-9 w-[200px]">
        <SelectValue placeholder="Selecionar banco..." />
      </SelectTrigger>
      <SelectContent>
        {databases.map((db) => (
          <SelectItem key={db.name} value={db.name}>
            <div className="flex items-center gap-2">
              <StatusDot status={db.status} />
              <span>{db.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
