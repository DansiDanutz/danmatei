import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  if (!switchable || !toggleTheme) return null;

  const light = theme === "light";
  const label = light ? "Dark" : "Albă";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={light ? "Activează tema întunecată" : "Activează tema albă"}
      className="touch-target inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-cyan/35 bg-brand-cyan/10 px-3 font-heading text-[10px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/18"
      title={light ? "Tema întunecată" : "Tema albă"}
    >
      {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
      <span>{label}</span>
    </button>
  );
}
