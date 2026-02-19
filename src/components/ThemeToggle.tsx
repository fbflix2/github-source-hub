import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border">
        <span className="material-symbols-outlined text-[20px] text-muted-foreground">
          light_mode
        </span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-10 h-10 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors border border-border"
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <span className="material-symbols-outlined text-[20px] text-foreground">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
