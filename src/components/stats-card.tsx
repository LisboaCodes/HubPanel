"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type TrendDirection = "up" | "down" | "neutral";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ElementType;
  trend?: {
    direction: TrendDirection;
    label?: string;
  };
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: StatsCardProps) {
  const getTrendIcon = (direction: TrendDirection) => {
    switch (direction) {
      case "up":
        return <TrendingUp className="h-3.5 w-3.5" />;
      case "down":
        return <TrendingDown className="h-3.5 w-3.5" />;
      case "neutral":
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const getTrendColor = (direction: TrendDirection) => {
    switch (direction) {
      case "up":
        return "text-emerald-500";
      case "down":
        return "text-red-500";
      case "neutral":
        return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {trend && (
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    getTrendColor(trend.direction)
                  )}
                >
                  {getTrendIcon(trend.direction)}
                  {trend.label && <span>{trend.label}</span>}
                </div>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
