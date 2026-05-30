/**
 * MatchPhotos — the per-match photo archive + the 24h post-match upload window.
 *
 * After a match has a final score, any group member (squad/group parents,
 * trainer, owner) can add photos for 24 hours; afterwards the gallery stays as
 * the group's archive. Photos live in the private bucket and are shown via
 * short-lived signed URLs served by /api/match/photos (they never go public).
 *
 * The 24h window + membership are enforced server-side by add_match_photo; the
 * countdown here is only a UX hint.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const BUCKET = "fotbal-media-private";

type Photo = {
  id: string;
  url: string;
  mime: string | null;
  createdAt: string;
  mine: boolean;
};

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function hoursLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function MatchPhotos({ eventId }: { eventId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [windowEndsAt, setWindowEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/match/photos?eventId=${eventId}`, {
      headers: { authorization: `Bearer ${await bearer()}` },
    });
    if (!r.ok) {
      setLoading(false);
      return;
    }
    const j = (await r.json()) as {
      photos: Photo[];
      canUpload: boolean;
      windowEndsAt: string | null;
    };
    setPhotos(j.photos ?? []);
    setCanUpload(!!j.canUpload);
    setWindowEndsAt(j.windowEndsAt ?? null);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Trebuie să fii autentificat.");
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: doar imagini.`);
        continue;
      }
      const ext =
        (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") ||
        "jpg";
      const path = `${user.id}/match/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        toast.error(`Încărcare eșuată: ${upErr.message}`);
        continue;
      }
      const { error: rpcErr } = await supabase.rpc("add_match_photo", {
        p_event: eventId,
        p_path: path,
        p_mime: file.type,
        p_bytes: file.size,
      });
      if (rpcErr) {
        // Don't leave an orphan object if the DB rejected the upload.
        await supabase.storage.from(BUCKET).remove([path]);
        toast.error(
          rpcErr.message === "window_closed"
            ? "Perioada de încărcare (24h) a expirat."
            : `Eroare: ${rpcErr.message}`
        );
        continue;
      }
      ok += 1;
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (ok > 0) {
      toast.success(`${ok} ${ok === 1 ? "poză adăugată" : "poze adăugate"}`);
      await load();
    }
  };

  if (loading) return null;
  if (!canUpload && photos.length === 0) return null;

  const left = hoursLeft(windowEndsAt);

  return (
    <div className="border-t border-white/8 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 font-heading text-[10px] uppercase tracking-[0.16em] text-white/55">
          <ImageIcon className="size-3.5 text-brand-cyan" />
          Poze ({photos.length})
        </h4>
        {canUpload && (
          <div className="flex items-center gap-2">
            {left && (
              <span className="inline-flex items-center gap-1 font-heading text-[9px] uppercase tracking-[0.12em] text-brand-gold/80">
                <Clock className="size-2.5" />
                încă {left}
              </span>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 font-heading text-[10px] uppercase tracking-[0.14em] text-brand-cyan transition-colors hover:bg-brand-cyan/20 disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Camera className="size-3" />
              )}
              Adaugă poze
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="mt-2 font-body text-xs text-white/40">
          Fii primul care adaugă poze de la acest meci.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
            >
              <img
                src={p.url}
                alt="Poză meci"
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
