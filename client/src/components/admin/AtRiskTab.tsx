/**
 * Admin → Risc tab.
 *
 * Surfaces children with attendance < 50% over the last 4+ tracked sessions
 * so the owner can intervene before the family drifts away.
 *
 * Reads from fotbal.v_child_stats (attendance counts + percent), joins back
 * to fotbal.children for name/age/group/trainer/photo and fotbal.profiles
 * for parent contact. RLS allows owner select on all of these.
 *
 * Each row gives one-tap "Sună" / "WhatsApp" actions with a soft-touch
 * Romanian opener pre-filled. Trainer attribution is included in the
 * message so the parent knows who's reaching out.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowUpDown,
  Loader2,
  MessageCircle,
  Phone,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type RiskRow = {
  child_id: string;
  full_name: string;
  dob: string;
  photo_path: string | null;
  age_group_label: string | null;
  attendance_total: number;
  attendance_present: number;
  attendance_percent: number;
  current_streak: number;
  parent: {
    full_name: string;
    phone: string | null;
  } | null;
  trainer: {
    full_name: string;
  } | null;
};

type SortBy = "percent" | "missed" | "name";

const RISK_PERCENT_THRESHOLD = 50;
const MIN_TRACKED_SESSIONS = 4;

function ageOf(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function whatsAppHrefFor(row: RiskRow): string | null {
  const phone = row.parent?.phone?.replace(/^\+/, "");
  if (!phone) return null;
  const childFirst = row.full_name.split(/\s+/)[0] ?? "copilul";
  const trainerName = row.trainer?.full_name ?? "antrenor";
  const opener = `Bună ziua, ${row.parent?.full_name?.split(/\s+/)[0] ?? ""}! Sunt ${trainerName} de la Academia Dan Matei. Am observat că ${childFirst} a lipsit la câteva antrenamente recent — totul e în regulă? Ne-ar bucura să-l revedem la grupă.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(opener)}`;
}

export default function AtRiskTab() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("percent");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      // Pull the stats view; v_child_stats grants select to authenticated.
      const { data: stats, error: statsErr } = await supabase
        .from("v_child_stats")
        .select(
          "child_id, attendance_total, attendance_present, attendance_percent, current_streak"
        )
        .gte("attendance_total", MIN_TRACKED_SESSIONS)
        .lt("attendance_percent", RISK_PERCENT_THRESHOLD);
      if (cancelled) return;
      if (statsErr) {
        setError(statsErr.message);
        setLoading(false);
        return;
      }

      type StatRow = {
        child_id: string;
        attendance_total: number;
        attendance_present: number;
        attendance_percent: number;
        current_streak: number;
      };
      const statsList = (stats ?? []) as StatRow[];
      if (statsList.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = statsList.map(s => s.child_id);
      const { data: kids, error: kidsErr } = await supabase
        .from("children")
        .select(
          "id, full_name, dob, photo_path, age_group_label, status, parent:profiles!children_parent_id_fkey(full_name, phone), trainer:trainers!children_trainer_id_fkey(profile:profiles!trainers_profile_id_fkey(full_name))"
        )
        .in("id", ids)
        .eq("status", "active");
      if (cancelled) return;
      if (kidsErr) {
        setError(kidsErr.message);
        setLoading(false);
        return;
      }

      type KidRow = {
        id: string;
        full_name: string;
        dob: string;
        photo_path: string | null;
        age_group_label: string | null;
        parent: { full_name: string; phone: string | null } | null;
        trainer: { profile: { full_name: string } | null } | null;
      };
      const byId = new Map<string, KidRow>(
        ((kids ?? []) as unknown as KidRow[]).map(k => [k.id, k])
      );

      const merged: RiskRow[] = statsList
        .map(s => {
          const kid = byId.get(s.child_id);
          if (!kid) return null;
          return {
            child_id: s.child_id,
            full_name: kid.full_name,
            dob: kid.dob,
            photo_path: kid.photo_path,
            age_group_label: kid.age_group_label,
            attendance_total: s.attendance_total,
            attendance_present: s.attendance_present,
            attendance_percent: s.attendance_percent,
            current_streak: s.current_streak,
            parent: kid.parent,
            trainer:
              kid.trainer?.profile?.full_name != null
                ? { full_name: kid.trainer.profile.full_name }
                : null,
          } satisfies RiskRow;
        })
        .filter((r): r is RiskRow => r !== null);

      setRows(merged);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortBy === "percent") {
      copy.sort((a, b) => a.attendance_percent - b.attendance_percent);
    } else if (sortBy === "missed") {
      copy.sort(
        (a, b) =>
          b.attendance_total -
          b.attendance_present -
          (a.attendance_total - a.attendance_present)
      );
    } else {
      copy.sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    return copy;
  }, [rows, sortBy]);

  if (loading) {
    return (
      <div className="grid place-items-center py-16 text-white/55">
        <Loader2 className="size-5 animate-spin text-brand-cyan" />
        <span className="mt-3 font-heading text-xs uppercase tracking-[0.18em]">
          Se calculează...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 p-6 font-body text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.06] p-8 text-center">
        <h3 className="font-heading text-lg uppercase tracking-wide text-emerald-200">
          Niciun jucător la risc
        </h3>
        <p className="mt-2 font-body text-sm text-white/65">
          Toți copiii cu peste {MIN_TRACKED_SESSIONS} sesiuni au prezență de
          peste {RISK_PERCENT_THRESHOLD}%. Bravo academiei.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl uppercase tracking-tight text-white">
            <AlertTriangle className="size-5 text-amber-300" />
            Jucători la risc
          </h2>
          <p className="mt-1 font-body text-sm text-white/60">
            {sorted.length}{" "}
            {sorted.length === 1
              ? "jucător activ cu prezență sub"
              : "jucători activi cu prezență sub"}{" "}
            {RISK_PERCENT_THRESHOLD}% (din minim {MIN_TRACKED_SESSIONS} sesiuni
            urmărite). Contactează părinții cât e încă timp.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-heading text-[10.5px] uppercase tracking-[0.16em] text-white/70">
          <ArrowUpDown className="size-3.5 text-white/45" />
          Sortează după
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="bg-transparent text-brand-cyan outline-none"
            aria-label="Sortează după"
          >
            <option value="percent" className="bg-[oklch(0.10_0.02_250)]">
              Prezență
            </option>
            <option value="missed" className="bg-[oklch(0.10_0.02_250)]">
              Absențe totale
            </option>
            <option value="name" className="bg-[oklch(0.10_0.02_250)]">
              Nume
            </option>
          </select>
        </label>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(row => {
          const initials = row.full_name
            .split(/\s+/)
            .slice(0, 2)
            .map(s => s[0]?.toUpperCase() ?? "")
            .join("");
          const missed = row.attendance_total - row.attendance_present;
          const wa = whatsAppHrefFor(row);
          const tone =
            row.attendance_percent < 30
              ? "border-rose-300/40 bg-rose-300/[0.05]"
              : "border-amber-300/35 bg-amber-300/[0.04]";
          return (
            <li
              key={row.child_id}
              className={`rounded-2xl border ${tone} p-4 sm:p-5`}
            >
              <header className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.05] font-heading text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/copil/${row.child_id}`}
                    className="block truncate font-heading text-base font-semibold uppercase tracking-[0.04em] text-white hover:text-brand-cyan"
                  >
                    {row.full_name}
                  </Link>
                  <p className="font-body text-[12px] text-white/55">
                    {ageOf(row.dob)} ani · {row.age_group_label ?? "Nealocat"}
                    {row.trainer?.full_name && ` · ${row.trainer.full_name}`}
                  </p>
                </div>
              </header>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-[oklch(0.10_0.02_250)]/55 p-3">
                <div>
                  <div className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Prezență
                  </div>
                  <div
                    className={`mt-0.5 font-heading text-2xl tabular-nums ${
                      row.attendance_percent < 30
                        ? "text-rose-300"
                        : "text-amber-300"
                    }`}
                  >
                    {row.attendance_percent}%
                  </div>
                </div>
                <div>
                  <div className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/45">
                    Absențe
                  </div>
                  <div className="mt-0.5 font-heading text-2xl text-white tabular-nums">
                    {missed}
                    <span className="ml-1 font-body text-xs text-white/45">
                      / {row.attendance_total}
                    </span>
                  </div>
                </div>
              </div>

              {row.parent?.full_name && (
                <p className="mt-3 font-body text-[12px] text-white/65">
                  Părinte:{" "}
                  <span className="text-white/85">{row.parent.full_name}</span>
                  {row.parent.phone && (
                    <span className="text-white/55"> · {row.parent.phone}</span>
                  )}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.parent?.phone && (
                  <a
                    href={`tel:${row.parent.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-cyan px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-[oklch(0.08_0.02_250)] hover:opacity-90"
                  >
                    <Phone className="size-3.5" />
                    Sună
                  </a>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 font-heading text-[11px] uppercase tracking-[0.16em] text-white/85 hover:bg-white/[0.10]"
                  >
                    <MessageCircle className="size-3.5" />
                    WhatsApp
                  </a>
                )}
                {!row.parent?.phone && (
                  <span className="font-heading text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Părintele n-a setat telefonul
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
