"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

type Props = {
  className?: string;
};

const THEME_CYCLE = ["light", "dark", "system"] as const;

const THEME_META = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  system: { icon: Monitor, label: "System" },
} as const;

export function ThemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-label="Theme"
        disabled
      />
    );
  }

  const current = (THEME_CYCLE as readonly string[]).includes(theme ?? "")
    ? (theme as (typeof THEME_CYCLE)[number])
    : "system";
  const { icon: Icon, label } = THEME_META[current];

  const cycle = () => {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      title={`Theme: ${label} (click to change)`}
      aria-label={`Theme: ${label}. Click to change`}
      onClick={cycle}
    >
      <Icon className="size-3.5" />
    </Button>
  );
}

/** Inline theme picker for settings pages */
export function ThemeSettingRow() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            theme === value
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
