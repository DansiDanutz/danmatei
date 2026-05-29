/**
 * PlayerStatsHeader — premium header for /copil/:childId.
 *
 * Reads `fotbal.v_child_stats` (attendance %, streak, matches, goals,
 * assists) + `fotbal.player_skills` (5-dim trainer rating) for the given
 * child and renders the audit-doc mockup: hero photo, name, badge, streak,
 * match line, skill tree, and (for trainer/owner) an "Editează abilități"
 * editor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cake,
  Camera,
  Edit3,
  Flame,
  Loader2,
  Save,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { currentAge, isBirthdayToday } from "@/lib/age";
import { useAuth } from "@/lib/auth";
import Confetti from "@/components/effects/Confetti";

const PHOTO_BUCKET = "fotbal-media-private";
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

type Child = {
  id: string;
  parent_id: string;
  full_name: string;
  dob: string;
  photo_path: string | null;
  age_group_label: string | null;
  trainer_id: string | null;
};

type Stats = {
  child_id: string;
  attendance_total: number;
  attendance_present: number;
  attendance_percent: number | null;
  current_streak: number;
  matches_played: number;
  goals_total: number;
  assists_total: number;
};

type Skills = {
  child_id: string;
  pasare: number;
  conducere: number;
  tehnica: number;
  cooperare: number;
  disciplina: number;
  notes: string | null;
  updated_at: string;
};

type SkillKey = "pasare" | "conducere" | "tehnica" | "cooperare" | "disciplina";

const SKILL_LABEL: Record<SkillKey, string> = {
  pasare: "Pasare",
  conducere: "Conducere",
  tehnica: "Tehnică",
  cooperare: "Cooperare",
  disciplina: "Disciplină",
};

const SKILL_ORDER: SkillKey[] = [
  "pasare",
  "conducere",
  "tehnica",
  "cooperare",
  "disciplina",
];

const DEFAULT_SKILLS = {
  pasare: 3,
  conducere: 3,
  tehnica: 3,
  cooperare: 3,
  disciplina: 3,
};

function avg(skills: Pick<Skills, SkillKey>): number {
  const sum = SKILL_ORDER.reduce((acc, k) => acc + skills[k], 0);
  return sum / SKILL_ORDER.length;
}

// Streak milestones — celebrated with a confetti burst the first time the
// child's current_streak crosses each threshold. Per-child localStorage
// remembers the last-seen value so we don't refire on every page visit.
const STREAK_MILESTONES = [5, 10, 20, 50] as const;

type StreakTier = {
  /** Romanian label shown under the streak number. */
  label: string;
  /** Tailwind color class for the streak number. */
  numberClass: string;
  /** Tailwind border + bg classes for the badge pill. */
  pillClass: string;
};

function streakTier(streak: number): StreakTier {
  if (streak >= 50) {
    return {
      label: "Legendă · 50+",
      numberClass: "text-[#e879f9]",
      pillClass: "border-[#e879f9]/45 bg-[#e879f9]/[0.10] text-[#e879f9]",
    };
  }
  if (streak >= 20) {
    return {
      label: "Aur · 20+",
      numberClass: "text-brand-gold",
      pillClass: "border-brand-gold/45 bg-brand-gold/[0.12] text-brand-gold",
    };
  }
  if (streak >= 10) {
    return {
      label: "Argint · 10+",
      numberClass: "text-slate-200",
      pillClass: "border-slate-200/40 bg-slate-200/[0.10] text-slate-200",
    };
  }
  if (streak >= 5) {
    return {
      label: "Bronz · 5+",
      numberClass: "text-amber-300",
      pillClass: "border-amber-300/45 bg-amber-300/[0.10] text-amber-300",
    };
  }
  return {
    label: streak > 0 ? "În creștere" : "Fără streak",
    numberClass: "text-brand-cyan",
    pillClass: "border-white/15 bg-white/[0.04] text-white/55",
  };
}

/**
 * Returns the highest milestone the kid has just crossed since `lastSeen`,
 * or null. Examples:
 *   lastSeen=4, current=5  → 5
 *   lastSeen=4, current=12 → 10  (skipped 5 only if both 5 and 10 were
 *                                 crossed between writes — rare, fire one)
 *   lastSeen=10, current=12 → null
 *   lastSeen=10, current=10 → null
 */
function justCrossedMilestone(
  current: number,
  lastSeen: number
): number | null {
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (current >= m && lastSeen < m) hit = m;
  }
  return hit;
}

function StarBar({ value }: { value: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rounded}/5`}
    >
      {[1, 2, 3, 4, 5].map(i => {
        const filled = rounded >= i;
        const half = !filled && rounded + 0.5 >= i;
        return (
          <Star
            key={i}
            className="size-3.5"
            fill={filled ? "currentColor" : half ? "currentColor" : "none"}
            style={half ? { clipPath: "inset(0 50% 0 0)" } : undefined}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        );
      })}
    </span>
  );
}

function SkillRow({
  k,
  value,
  editable,
  onChange,
}: {
  k: SkillKey;
  value: number;
  editable: boolean;
  onChange?: (next: number) => void;
}) {
  const pct = (value / 5) * 100;
  const tone =
    value >= 4 ? "bg-brand-gold" : value >= 3 ? "bg-brand-cyan" : "bg-white/30";
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 sm:w-24 font-heading text-[11px] uppercase tracking-[0.16em] text-white/70">
        {SKILL_LABEL[k]}
      </span>
      <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full ${tone} transition-[width] duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {editable && onChange ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, value - 1))}
            className="size-6 rounded-md bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08]"
            aria-label="Mai puțin"
          >
            −
          </button>
          <span className="w-6 text-center font-heading text-sm text-brand-cyan tabular-nums">
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(Math.min(5, value + 1))}
            className="size-6 rounded-md bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08]"
            aria-label="Mai mult"
          >
            +
          </button>
        </div>
      ) : (
        <span className="w-10 text-right font-heading text-xs text-white/60 tabular-nums">
          {value}/5
        </span>
      )}
    </div>
  );
}

export default function PlayerStatsHeader({
  child,
  onPhotoChanged,
}: {
  child: Child;
  /** Called with the new storage path after a successful upload so the parent
   *  page can update its local Child state and avoid a full refetch. */
  onPhotoChanged?: (newPhotoPath: string) => void;
}) {
  const { profile } = useAuth();
  const canEditSkills =
    profile?.role === "trainer" ||
    profile?.role === "owner" ||
    profile?.role === "super_admin";
  const canEditPhoto =
    profile?.id === child.parent_id ||
    profile?.role === "owner" ||
    profile?.role === "super_admin";

  const [stats, setStats] = useState<Stats | null>(null);
  const [skills, setSkills] = useState<Skills | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: sk }] = await Promise.all([
      supabase
        .from("v_child_stats")
        .select(
          "child_id, attendance_total, attendance_present, attendance_percent, current_streak, matches_played, goals_total, assists_total"
        )
        .eq("child_id", child.id)
        .maybeSingle(),
      supabase
        .from("player_skills")
        .select(
          "child_id, pasare, conducere, tehnica, cooperare, disciplina, notes, updated_at"
        )
        .eq("child_id", child.id)
        .maybeSingle(),
    ]);
    setStats((s as Stats | null) ?? null);
    setSkills((sk as Skills | null) ?? null);
    setLoading(false);
  }, [child.id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Hero photo via signed URL (storage_path is private)
  useEffect(() => {
    let cancelled = false;
    if (!child.photo_path) {
      setPhotoUrl(null);
      return;
    }
    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(child.photo_path, 60 * 60 * 4)
      .then(({ data }) => {
        if (!cancelled) setPhotoUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [child.photo_path]);

  const age = useMemo(() => currentAge(child.dob), [child.dob]);
  const isBirthday = useMemo(() => isBirthdayToday(child.dob), [child.dob]);
  const skillView = skills ?? {
    ...DEFAULT_SKILLS,
    child_id: child.id,
    notes: null,
    updated_at: "",
  };
  const skillAvg = avg(skillView);

  // Confetti fires for two distinct reasons: birthdays (every visit on the
  // day) and streak milestones (once when crossed, remembered in
  // localStorage). One mount, two triggers.
  const [confettiToggle, setConfettiToggle] = useState(false);
  const [milestoneHit, setMilestoneHit] = useState<number | null>(null);

  useEffect(() => {
    if (isBirthday) {
      setConfettiToggle(false);
      const t = setTimeout(() => setConfettiToggle(true), 50);
      return () => clearTimeout(t);
    }
    setConfettiToggle(false);
  }, [isBirthday, child.id]);

  // Streak milestone detection. Runs after stats load.
  useEffect(() => {
    if (!stats) return;
    if (typeof window === "undefined") return;
    const key = `danmatei_streak_${child.id}`;
    const raw = window.localStorage.getItem(key);
    const lastSeen = raw ? Number(raw) : 0;
    const hit = justCrossedMilestone(stats.current_streak, lastSeen);
    if (hit !== null) {
      setMilestoneHit(hit);
      // Re-fire confetti even if birthday already lit it — toggle off then on.
      setConfettiToggle(false);
      const t = setTimeout(() => setConfettiToggle(true), 80);
      // Auto-clear the milestone tag so the celebratory ring fades.
      const clearTag = setTimeout(() => setMilestoneHit(null), 6000);
      window.localStorage.setItem(key, String(stats.current_streak));
      return () => {
        clearTimeout(t);
        clearTimeout(clearTag);
      };
    }
    // Always sync localStorage to current so a streak reset doesn't get
    // celebrated again later.
    window.localStorage.setItem(key, String(stats.current_streak));
  }, [stats, child.id]);

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Doar imagini, te rugăm.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Fișierul e prea mare. Maxim 8 MB.");
      return;
    }

    setUploadingPhoto(true);
    // Storage RLS requires the path to start with auth.uid().
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${profile.id}/${child.id}/profile-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setUploadingPhoto(false);
      toast.error(`Nu am putut urca poza: ${upErr.message}`);
      return;
    }

    const { error: updErr } = await supabase
      .from("children")
      .update({ photo_path: path })
      .eq("id", child.id);
    if (updErr) {
      setUploadingPhoto(false);
      // Best-effort cleanup: remove the orphan upload.
      void supabase.storage.from(PHOTO_BUCKET).remove([path]);
      toast.error(`Nu am putut salva poza: ${updErr.message}`);
      return;
    }

    // Refresh the signed URL immediately so the new photo shows without reload.
    const { data: signed } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60 * 60 * 4);
    setPhotoUrl(signed?.signedUrl ?? null);
    setUploadingPhoto(false);
    onPhotoChanged?.(path);
    toast.success("Poza a fost actualizată.");
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/8 bg-[oklch(0.10_0.02_250)]">
      {/* Birthday celebration — banner + confetti only on the day. */}
      {isBirthday && (
        <>
          <Confetti fire={confettiToggle} durationMs={4500} count={70} />
          <div className="flex flex-wrap items-center justify-center gap-3 bg-gradient-to-r from-brand-gold/30 via-brand-gold/15 to-brand-cyan/25 px-4 py-2.5 text-center">
            <Cake className="size-4 text-brand-gold" />
            <span className="font-heading text-sm uppercase tracking-[0.16em] text-white">
              La mulți ani, {child.full_name.split(" ")[0]}!
            </span>
            <span className="font-heading text-[11px] uppercase tracking-[0.2em] text-brand-gold">
              {age} ani
            </span>
          </div>
        </>
      )}
      {/* Hero band — photo + name */}
      <div className="relative h-44 sm:h-52">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={child.full_name}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.78_0.13_210/0.25),oklch(0.08_0.02_250)_60%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.08_0.02_250)] via-[oklch(0.08_0.02_250)]/40 to-transparent" />
        {child.age_group_label && (
          <span className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/55 border border-brand-gold/40 backdrop-blur-md font-heading text-[10px] uppercase tracking-[0.22em] text-brand-gold">
            {child.age_group_label}
          </span>
        )}
        {canEditPhoto && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label={photoUrl ? "Schimbă poza" : "Adaugă poza copilului"}
              className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/40 bg-black/55 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.18em] text-brand-cyan backdrop-blur-md transition-colors hover:border-brand-cyan/70 hover:bg-brand-cyan/15 disabled:opacity-60"
            >
              {uploadingPhoto ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Camera className="size-3.5" />
              )}
              {photoUrl ? "Schimbă poza" : "Adaugă poza"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickPhoto}
              disabled={uploadingPhoto}
              className="sr-only"
            />
          </>
        )}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl sm:text-4xl uppercase leading-[0.95] text-white truncate">
              {child.full_name}
            </h1>
            <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-brand-cyan font-bold">
              {age} ani · Naștere{" "}
              {new Date(child.dob).toLocaleDateString("ro-RO", {
                year: "numeric",
                month: "short",
              })}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55 font-bold">
              Skill
            </div>
            <div className="mt-1 text-brand-gold">
              <StarBar value={skillAvg} />
            </div>
            <div className="text-[10px] mt-1 text-white/45 font-bold tabular-nums">
              {skillAvg.toFixed(1)} / 5
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06]">
        {/* Streak — bespoke tier badge instead of the generic Stat layout */}
        <StreakCard
          streak={stats?.current_streak ?? null}
          milestoneHit={milestoneHit}
        />
        <Stat
          label="Prezență"
          value={
            stats?.attendance_percent != null
              ? `${stats.attendance_percent}%`
              : "—"
          }
          tone={
            stats?.attendance_percent && stats.attendance_percent >= 80
              ? "gold"
              : "cyan"
          }
          sub={
            stats
              ? `${stats.attendance_present}/${stats.attendance_total} sesiuni`
              : "—"
          }
        />
        <Stat
          label="Goluri"
          value={stats ? String(stats.goals_total) : "—"}
          icon={<Trophy className="size-3.5" />}
          tone="gold"
          sub={stats ? `${stats.matches_played} meciuri` : "—"}
        />
        <Stat
          label="Asisturi"
          value={stats ? String(stats.assists_total) : "—"}
          tone="cyan"
          sub="pase decisive"
        />
      </div>

      {/* Skill tree */}
      <div className="p-4 sm:p-5 space-y-2.5">
        <header className="flex items-center justify-between">
          <h2 className="font-heading text-sm uppercase tracking-[0.18em] text-white">
            Profilul de joc
          </h2>
          {canEditSkills && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan text-[10px] uppercase tracking-[0.18em] font-heading hover:bg-brand-cyan/20"
            >
              <Edit3 className="size-3" />
              Editează
            </button>
          )}
        </header>

        {loading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="size-4 animate-spin text-brand-cyan" />
          </div>
        ) : editing ? (
          <SkillEditor
            childId={child.id}
            initial={skillView}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await refetch();
            }}
          />
        ) : (
          <div className="space-y-2">
            {SKILL_ORDER.map(k => (
              <SkillRow k={k} value={skillView[k]} editable={false} key={k} />
            ))}
            {skills?.updated_at && (
              <div className="pt-2 text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">
                Actualizat{" "}
                {new Date(skills.updated_at).toLocaleDateString("ro-RO")}
              </div>
            )}
            {!skills && (
              <div className="pt-2 text-[10px] uppercase tracking-[0.18em] text-white/35 font-bold">
                Valori implicite — antrenorul nu a evaluat încă
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone: "cyan" | "gold";
}) {
  const valColor = tone === "gold" ? "text-brand-gold" : "text-brand-cyan";
  return (
    <div className="bg-[oklch(0.10_0.02_250)] p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-white/55 font-bold">
        {icon}
        {label}
      </div>
      <div className={`font-heading text-3xl leading-none mt-2 ${valColor}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10.5px] text-white/55">{sub}</div>}
    </div>
  );
}

// Streak card replaces the generic Stat for the streak slot. Shows a tier
// pill (Bronz / Argint / Aur / Legendă) and gets a temporary cyan glow ring
// when the kid just crossed a milestone.
function StreakCard({
  streak,
  milestoneHit,
}: {
  streak: number | null;
  milestoneHit: number | null;
}) {
  const value = streak ?? 0;
  const tier = streakTier(value);
  const sub =
    streak === null
      ? "—"
      : streak > 0
        ? "antrenamente la rând"
        : "fără antrenamente recente";

  return (
    <div
      className={`relative bg-[oklch(0.10_0.02_250)] p-3 sm:p-4 transition-shadow ${
        milestoneHit !== null
          ? "shadow-[inset_0_0_0_2px_oklch(0.78_0.13_210/0.55)]"
          : ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-white/55 font-bold">
        <Flame className="size-3.5" />
        Streak
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div
          className={`font-heading text-3xl leading-none tabular-nums ${tier.numberClass}`}
        >
          {streak === null ? "—" : streak}
        </div>
        <span
          className={`rounded-full border px-1.5 py-0.5 font-heading text-[9px] uppercase tracking-[0.18em] ${tier.pillClass}`}
        >
          {tier.label}
        </span>
      </div>
      {milestoneHit !== null && (
        <div className="mt-1 font-heading text-[10.5px] uppercase tracking-[0.18em] text-brand-cyan">
          ⚡ Pragul {milestoneHit} atins!
        </div>
      )}
      {milestoneHit === null && (
        <div className="mt-1 text-[10.5px] text-white/55">{sub}</div>
      )}
    </div>
  );
}

function SkillEditor({
  childId,
  initial,
  onCancel,
  onSaved,
}: {
  childId: string;
  initial: Pick<Skills, SkillKey> & { notes: string | null };
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<SkillKey, number>>(() => ({
    pasare: initial.pasare,
    conducere: initial.conducere,
    tehnica: initial.tehnica,
    cooperare: initial.cooperare,
    disciplina: initial.disciplina,
  }));
  const [notes, setNotes] = useState<string>(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("player_skills").upsert(
      {
        child_id: childId,
        ...draft,
        notes: notes.trim() ? notes.trim() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "child_id" }
    );
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    await onSaved();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {SKILL_ORDER.map(k => (
          <SkillRow
            k={k}
            value={draft[k]}
            editable
            onChange={next => setDraft(d => ({ ...d, [k]: next }))}
            key={k}
          />
        ))}
      </div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notițe pentru părinte (opțional)"
        rows={2}
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-sm text-white/85 placeholder-white/30 outline-none focus:border-brand-cyan/50"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-white/80 text-[11px] uppercase tracking-[0.16em] font-heading hover:bg-white/[0.04]"
        >
          <X className="size-3.5" /> Renunță
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-brand-cyan text-[oklch(0.08_0.02_250)] text-[11px] uppercase tracking-[0.16em] font-heading hover:opacity-90 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Salvează
        </button>
      </div>
    </div>
  );
}
