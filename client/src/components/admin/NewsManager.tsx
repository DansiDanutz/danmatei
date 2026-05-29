/**
 * NewsManager — Admin CRUD for fotbal.news posts.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Newspaper,
  Save,
  Sparkles,
  Trash2,
  Pencil,
  X,
  ImagePlus,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ── Types ───────────────────────────────────────────────────────────────────

type NewsRow = {
  id: string;
  title: string;
  body_md: string;
  cover_path: string | null;
  audience: "public" | "members" | "group";
  group_trainer_id: string | null;
  published_at: string | null;
  created_at: string;
  author: { full_name: string } | null;
};

type TrainerOption = {
  id: string;
  full_name: string;
};

// ── Schema ──────────────────────────────────────────────────────────────────

const newsSchema = z.object({
  title: z.string().min(2, "Titlu prea scurt").max(200),
  body_md: z.string().min(10, "Conținut prea scurt").max(5000),
  audience: z.enum(["public", "members", "group"]),
  group_trainer_id: z.string().optional().or(z.literal("")),
  published_at: z.string().optional().or(z.literal("")),
});
type NewsValues = z.infer<typeof newsSchema>;

// ── Component ───────────────────────────────────────────────────────────────

export default function NewsManager() {
  const [posts, setPosts] = useState<NewsRow[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewsValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      audience: "public",
      title: "",
      body_md: "",
    },
  });

  const audience = watch("audience");

  const load = async () => {
    setLoading(true);
    setError(null);
    const [{ data: pData, error: pErr }, { data: tData }] = await Promise.all([
      supabase
        .from("news")
        .select(
          "id, title, body_md, cover_path, audience, group_trainer_id, published_at, created_at, author:profiles!news_author_id_fkey(full_name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("trainers")
        .select("id, profile:profiles!trainers_profile_id_fkey(full_name)")
        .eq("active", true),
    ]);
    if (pErr) {
      setError(pErr.message);
    } else {
      setPosts((pData ?? []) as unknown as NewsRow[]);
    }
    const tOpts =
      (
        tData as unknown as
          | { id: string; profile: { full_name: string } | null }[]
          | null
      )
        ?.filter(t => t.profile)
        .map(t => ({ id: t.id, full_name: t.profile!.full_name })) ?? [];
    setTrainers(tOpts);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftWeekly = async () => {
    setDrafting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Sesiune expirată — autentifică-te din nou.");
        return;
      }
      const r = await fetch("/api/news/draft-weekly", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        title?: string;
        body_md?: string;
        sources?: { recaps: number; matches: number; newFamilies: number };
        error?: string;
      };
      if (r.status === 503 && j.error === "ai_not_configured") {
        setAiDisabled(true);
        toast.info("AI-ul nu e configurat", {
          description:
            "Adaugă OPENAI_API_KEY pe Vercel pentru a folosi draft-ul automat.",
        });
        return;
      }
      if (!r.ok || !j.ok || !j.title || !j.body_md) {
        toast.error("Nu am putut genera articolul", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      // Pre-fill the form. Trainer reviews + clicks Save like normal.
      setValue("title", j.title, { shouldDirty: true });
      setValue("body_md", j.body_md, { shouldDirty: true });
      setEditingId(null); // ensure we're in "create new" mode
      const src = j.sources;
      toast.success("Draft generat", {
        description: src
          ? `Bazat pe ${src.recaps} antrenamente, ${src.matches} meciuri, ${src.newFamilies} familii noi.`
          : "Verifică textul și apasă Salvează.",
      });
    } catch (err) {
      toast.error("Eroare de rețea", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDrafting(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCoverPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverPreview(null);
    }
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile) return null;
    const ext = coverFile.name.split(".").pop() ?? "jpg";
    const path = `news/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("fotbal-news-public")
      .upload(path, coverFile, { upsert: true });
    if (upErr) throw upErr;
    return path;
  };

  const onSubmit = handleSubmit(async v => {
    setError(null);
    try {
      let coverPath: string | null = null;
      if (coverFile) {
        coverPath = await uploadCover();
      }

      const payload = {
        title: v.title,
        body_md: v.body_md,
        audience: v.audience,
        group_trainer_id:
          v.audience === "group" && v.group_trainer_id
            ? v.group_trainer_id
            : null,
        published_at: v.published_at
          ? new Date(v.published_at).toISOString()
          : new Date().toISOString(),
        cover_path: coverPath,
      };

      if (editingId) {
        const { error: upErr } = await supabase
          .from("news")
          .update(payload)
          .eq("id", editingId);
        if (upErr) throw upErr;
      } else {
        const { error: inErr } = await supabase.from("news").insert(payload);
        if (inErr) throw inErr;
      }

      reset({ audience: "public", title: "", body_md: "" });
      setEditingId(null);
      setCoverFile(null);
      setCoverPreview(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvare.");
    }
  });

  const startEdit = (post: NewsRow) => {
    setEditingId(post.id);
    setValue("title", post.title);
    setValue("body_md", post.body_md);
    setValue("audience", post.audience);
    setValue("group_trainer_id", post.group_trainer_id ?? "");
    setValue(
      "published_at",
      post.published_at
        ? new Date(post.published_at).toISOString().slice(0, 16)
        : ""
    );
    if (post.cover_path) {
      const { data } = supabase.storage
        .from("fotbal-news-public")
        .getPublicUrl(post.cover_path);
      setCoverPreview(data.publicUrl);
    } else {
      setCoverPreview(null);
    }
    setCoverFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset({ audience: "public", title: "", body_md: "" });
    setCoverFile(null);
    setCoverPreview(null);
  };

  const deletePost = async (id: string) => {
    if (!confirm("Sigur vrei să ștergi acest articol?")) return;
    const { error: delErr } = await supabase.from("news").delete().eq("id", id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    load();
  };

  const dateFmt = new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Form */}
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-3xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-5 lg:col-span-1"
      >
        <h2 className="font-heading text-[11px] uppercase tracking-[0.2em] text-white/55">
          {editingId ? "Editează articol" : "Articol nou"}
        </h2>

        <Field
          id="n-title"
          label="Titlu"
          {...register("title")}
          error={errors.title?.message}
          placeholder="Titlu știre"
        />

        {/* AI weekly draft — pre-fills title + body_md based on the last 7
         *  days of training recaps, match results, and new families. Hidden
         *  once we know AI is off (503) so owners don't keep clicking. */}
        {!aiDisabled && !editingId && (
          <button
            type="button"
            onClick={() => void draftWeekly()}
            disabled={drafting}
            className="inline-flex items-center gap-2 self-start rounded-full border border-brand-cyan/40 bg-brand-cyan/[0.08] px-4 py-2 font-heading text-[11px] uppercase tracking-[0.16em] text-brand-cyan transition-colors hover:bg-brand-cyan/15 disabled:opacity-60"
          >
            {drafting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            Draft săptămânal cu AI
          </button>
        )}

        <div>
          <label
            htmlFor="n-body"
            className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
          >
            Conținut
          </label>
          <textarea
            id="n-body"
            rows={6}
            {...register("body_md")}
            placeholder="Scrie conținutul articolului…"
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
          />
          {errors.body_md && (
            <p className="mt-1 font-body text-xs text-rose-300/85">
              {errors.body_md.message}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Audiență
          </label>
          <select
            {...register("audience")}
            className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white"
          >
            <option value="public">Public</option>
            <option value="members">Membri (autentificați)</option>
            <option value="group">Grupă specifică</option>
          </select>
        </div>

        {audience === "group" && (
          <div>
            <label className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
              Grupa antrenorului
            </label>
            <select
              {...register("group_trainer_id")}
              className="w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white"
            >
              <option value="">Alege antrenorul…</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Field
          id="n-published"
          label="Data publicării (lasă gol pentru acum)"
          type="datetime-local"
          {...register("published_at")}
        />

        {/* Cover image */}
        <div>
          <label className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55">
            Imagine copertă
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 transition-colors hover:border-brand-cyan/30">
            <ImagePlus className="size-4 text-white/40" />
            <span className="font-body text-xs text-white/50">
              {coverFile ? coverFile.name : "Alege imagine…"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="sr-only"
            />
          </label>
          {coverPreview && (
            <img
              src={coverPreview}
              alt="Preview"
              className="mt-2 aspect-video w-full rounded-xl object-cover"
            />
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-1.5 font-body text-xs text-rose-200">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="touch-target inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-cyan px-4 py-2.5 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.08_0.02_250)] transition-colors hover:bg-[oklch(0.82_0.13_220)] disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <Save className="size-3.5" />
                {editingId ? "Actualizează" : "Publică"}
              </>
            )}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 font-heading text-[11px] uppercase tracking-[0.14em] text-white/70"
            >
              <X className="size-3" />
              Anulează
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div className="grid gap-3 lg:col-span-2">
        {loading && (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-5 animate-spin text-brand-cyan" />
          </div>
        )}
        {!loading && posts.length === 0 && (
          <Empty hint="Nu există încă articole." />
        )}
        {posts.map(post => (
          <article
            key={post.id}
            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-[oklch(0.13_0.03_250)]/70 p-4 sm:flex-row sm:items-start sm:gap-4"
          >
            {post.cover_path && (
              <img
                src={
                  supabase.storage
                    .from("fotbal-news-public")
                    .getPublicUrl(post.cover_path).data.publicUrl
                }
                alt=""
                className="aspect-[16/9] w-full shrink-0 rounded-xl object-cover sm:aspect-square sm:w-24"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 font-heading text-[9px] uppercase tracking-[0.16em] ${
                    post.audience === "public"
                      ? "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan"
                      : post.audience === "members"
                        ? "border-brand-gold/30 bg-brand-gold/10 text-brand-gold"
                        : "border-white/15 bg-white/[0.04] text-white/60"
                  }`}
                >
                  {post.audience}
                </span>
                <span className="flex items-center gap-1 font-body text-[10px] text-white/40">
                  <Tag className="size-3" />
                  {post.published_at
                    ? dateFmt.format(new Date(post.published_at))
                    : "Nepublicat"}
                </span>
              </div>
              <h3 className="mt-1.5 font-heading text-sm font-semibold uppercase tracking-[0.04em] text-white">
                {post.title}
              </h3>
              <p className="mt-1 line-clamp-2 font-body text-xs text-white/60">
                {post.body_md}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col">
              <button
                type="button"
                onClick={() => startEdit(post)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-heading text-[10px] uppercase tracking-[0.12em] text-white/70 transition-colors hover:text-brand-cyan"
              >
                <Pencil className="size-3" />
                Editează
              </button>
              <button
                type="button"
                onClick={() => deletePost(post.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300/20 bg-rose-300/10 px-2.5 py-1.5 font-heading text-[10px] uppercase tracking-[0.12em] text-rose-300 transition-colors hover:bg-rose-300/20"
              >
                <Trash2 className="size-3" />
                Șterge
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const Field = ({
  id,
  label,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
}) => (
  <div>
    <label
      htmlFor={id}
      className="mb-1.5 block font-heading text-[10px] uppercase tracking-[0.2em] text-white/55"
    >
      {label}
    </label>
    <input
      id={id}
      {...rest}
      className="touch-target w-full rounded-xl border border-white/10 bg-[oklch(0.10_0.02_250)] px-3 py-2 font-body text-sm text-white placeholder:text-white/25 focus:border-brand-cyan/60"
    />
    {error && (
      <p className="mt-1 font-body text-xs text-rose-300/85">{error}</p>
    )}
  </div>
);

const Empty = ({ hint }: { hint: string }) => (
  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center font-body text-sm text-white/55">
    {hint}
  </div>
);
