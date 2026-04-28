/**
 * POST /api/trainers — owner-only. Creates a Supabase auth user with
 * `app: 'fotbal', role: 'trainer'` metadata (so the profile trigger fires)
 * and inserts the matching `fotbal.trainers` row. Returns the new trainer
 * row + an auth invite link the owner can copy/send.
 *
 * Auth: caller must be authenticated AND have `role = 'owner'` in their
 * fotbal.profiles row. Verified server-side using userClient(jwt).
 */
import { z } from "zod";
import { serviceClient, userClient, getJwtFromHeader } from "./_lib/supabase";

const Body = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  whatsappNumber: z.string().max(30).optional().nullable(),
  elevenlabsAgentId: z.string().max(120).optional().nullable(),
  position: z.string().max(120).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  ageMin: z.number().int().min(4).max(25),
  ageMax: z.number().int().min(4).max(25),
  certifications: z.array(z.string().max(60)).max(10).optional(),
});

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type Res = {
  status: (n: number) => Res;
  json: (body: unknown) => Res;
  setHeader?: (k: string, v: string) => void;
  end?: () => void;
};

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader =
    (typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : Array.isArray(req.headers?.authorization)
        ? req.headers.authorization[0]
        : undefined) ?? "";
  const jwt = getJwtFromHeader(authHeader);
  if (!jwt) return res.status(401).json({ error: "Missing bearer token" });

  // Verify caller is the owner.
  let isOwner = false;
  try {
    const u = userClient(jwt);
    const { data, error } = await u.from("profiles").select("role").single();
    if (error) throw error;
    isOwner = data?.role === "owner";
  } catch (e) {
    return res.status(401).json({ error: (e as Error).message });
  }
  if (!isOwner) return res.status(403).json({ error: "Owner role required" });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Invalid body", issues: parsed.error.issues });
  }
  const v = parsed.data;
  if (v.ageMax < v.ageMin) {
    return res.status(400).json({ error: "ageMax must be >= ageMin" });
  }

  const svc = serviceClient();

  // 1. Invite the user via Supabase Auth — this creates the auth.users row
  //    and emails them a setup link. The trigger on auth.users creates the
  //    fotbal.profiles row because we set raw_user_meta_data.app='fotbal'.
  // @ts-expect-error auth.admin exists on service-role client but TS types hide it
  const invite = await svc.auth.admin.inviteUserByEmail(v.email, {
    data: {
      app: "fotbal",
      role: "trainer",
      full_name: v.fullName,
      phone: v.phone ?? null,
    },
  });
  if (invite.error) {
    return res.status(400).json({ error: invite.error.message });
  }
  const userId = invite.data.user?.id;
  if (!userId)
    return res.status(500).json({ error: "Auth invite returned no user id" });

  // 2. Patch the profile (the trigger seeded role='trainer' from meta — we
  //    just confirm + set phone in case the meta wasn't picked up).
  await svc.from("profiles").upsert(
    {
      id: userId,
      full_name: v.fullName,
      phone: v.phone ?? null,
      role: "trainer",
    },
    { onConflict: "id" }
  );

  // 3. Insert the trainer row.
  const { data: trainerRow, error: trErr } = await svc
    .from("trainers")
    .insert({
      profile_id: userId,
      position: v.position ?? null,
      bio: v.bio ?? null,
      age_min: v.ageMin,
      age_max: v.ageMax,
      certifications: v.certifications ?? [],
      whatsapp_number: v.whatsappNumber ?? null,
      elevenlabs_agent_id: v.elevenlabsAgentId ?? null,
    })
    .select(
      "id, profile_id, position, bio, age_min, age_max, certifications, whatsapp_number, elevenlabs_agent_id, active, created_at"
    )
    .single();
  if (trErr || !trainerRow) {
    return res.status(500).json({ error: trErr?.message ?? "Insert failed" });
  }

  return res.status(200).json({
    trainer: trainerRow,
    inviteEmailSent: true,
  });
}
