/**
 * Curated coaching-tip library — the reliable floor for the daily digest.
 *
 * Each tip is grounded in a real, recognised methodology (La Masia, Ajax, Coerver,
 * Horst Wein, DFB, LTAD, tactical periodization). The cron serves these directly
 * when the LLM is unavailable, and uses each day's tip theme/source to seed a
 * fresh AI variant when it is — so the digest is never empty and never stale.
 *
 * Romanian copy: the academy's audience is Romanian.
 */

export type AgeBand = "U5-U8" | "U9-U12" | "U13-U15" | "U16-U19" | "owner";

export type CoachingTip = {
  bands: AgeBand[];
  theme: string;
  title: string;
  body: string;
  source: string;
};

/** Map a trainer's age range to a band; defaults to U9–U12 when unknown. */
export function bandForAge(
  ageMin?: number | null,
  ageMax?: number | null
): AgeBand {
  const lo = ageMin ?? null;
  const hi = ageMax ?? null;
  const mid =
    lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi ?? 10);
  if (mid <= 8) return "U5-U8";
  if (mid <= 12) return "U9-U12";
  if (mid <= 15) return "U13-U15";
  return "U16-U19";
}

export function bandLabel(band: AgeBand): string {
  switch (band) {
    case "U5-U8":
      return "U5–U8 (mini-fotbal)";
    case "U9-U12":
      return "U9–U12 (formare tehnică)";
    case "U13-U15":
      return "U13–U15 (formare tactică)";
    case "U16-U19":
      return "U16–U19 (pre-seniori)";
    case "owner":
      return "conducerea academiei (toate grupele)";
  }
}

export const COACHING_TIPS: CoachingTip[] = [
  // ── U5–U8 ──────────────────────────────────────────────────────────────
  {
    bands: ["U5-U8"],
    theme: "Mingea ca prieten",
    title: "Fiecare copil, mingea lui",
    body: "La aceste vârste tehnica vine din numărul de atingeri. Asigură-te că fiecare copil are o minge la majoritatea exercițiilor — fără cozi de așteptare. 200+ atingeri pe antrenament bat orice tactică.",
    source: "Metodologia Coerver / La Masia",
  },
  {
    bands: ["U5-U8"],
    theme: "Jocul ca profesor",
    title: "Lasă jocul să predea",
    body: "Înlocuiește exercițiile în șir cu jocuri mici 2v2 și 3v3. Copiii învață deciziile jucând, nu ascultând explicații lungi. Vorbește puțin, lasă-i să se joace mult.",
    source: "Horst Wein – fotbal pentru copii",
  },
  {
    bands: ["U5-U8"],
    theme: "Coordonare",
    title: "ABC-ul mișcării cu mingea",
    body: "Include 10 minute de coordonare: dribling printre jaloane, opriri, schimbări de direcție. Dezvoltarea motrică de acum este fundația tehnicii de mai târziu.",
    source: "Modelul LTAD (dezvoltare pe termen lung)",
  },
  {
    bands: ["U5-U8"],
    theme: "Curaj fără presiune",
    title: "Nu ține scorul",
    body: "La antrenament laudă curajul de a dribla, nu pasul „de siguranță”. Copiii care îndrăznesc azi devin jucătorii creativi de mâine. Bucuria ține copiii în fotbal.",
    source: "Filozofia jocului liber – Ajax",
  },
  {
    bands: ["U5-U8"],
    theme: "Formate mici",
    title: "Terenuri mici, multe goluri",
    body: "Joacă pe spații mici, 4v4 fără portar, cu porți multiple. Mai multe atingeri, mai multe goluri, mai multă bucurie — exact ce au nevoie la 6–8 ani.",
    source: "Federația Germană (DFB) – formate mici",
  },

  // ── U9–U12 ─────────────────────────────────────────────────────────────
  {
    bands: ["U9-U12"],
    theme: "1v1 și curaj",
    title: "Maestrul lui 1v1",
    body: "Dedică o parte din fiecare antrenament situațiilor 1v1. Învață 2–3 mișcări de depășire și încurajează repetarea lor în joc. Curajul de a ataca adversarul se antrenează.",
    source: "Coerver Coaching",
  },
  {
    bands: ["U9-U12"],
    theme: "Jocuri cu spațiu redus",
    title: "Totul într-un joc 4v4",
    body: "Jocurile 4v4 și 5v5 dezvoltă simultan tehnica, deciziile și condiția fizică. Variază regulile (atingeri limitate, porți multiple) ca să accentuezi obiectivul zilei.",
    source: "Metodologia FC Barcelona (SSG)",
  },
  {
    bands: ["U9-U12"],
    theme: "Rondo",
    title: "Începe cu un rondo",
    body: "Deschide antrenamentul cu un rondo 5v2. Antrenezi pasa sub presiune, primul control orientat și decizia rapidă — fundamentul jocului pozițional.",
    source: "La Masia / Johan Cruyff",
  },
  {
    bands: ["U9-U12"],
    theme: "Primul control",
    title: "Controlul care câștigă timp",
    body: "Insistă pe controlul orientat: primul contact îndreaptă mingea spre spațiul liber. Un control bun cumpără timp și spațiu. Exersează cu mingi venite din unghiuri diferite.",
    source: "Ajax – modelul TIPS (tehnică)",
  },
  {
    bands: ["U9-U12"],
    theme: "Piciorul slab",
    title: "Antrenează piciorul „slab”",
    body: "Alocă exerciții dedicate piciorului slab. La 9–12 ani fereastra de învățare e deschisă; un jucător bipied valorează dublu peste câțiva ani.",
    source: "Dezvoltare tehnică DFB",
  },
  {
    bands: ["U9-U12"],
    theme: "Întrebări, nu comenzi",
    title: "Întreabă „ce vezi?”",
    body: "În loc de „pasează!”, întreabă „ce vezi?”. Antrenarea prin întrebări (guided discovery) crește inteligența de joc mai mult decât instrucțiunile directe.",
    source: "Pedagogia academiei Ajax",
  },

  // ── U13–U15 ────────────────────────────────────────────────────────────
  {
    bands: ["U13-U15"],
    theme: "Joc pozițional",
    title: "Lățime, adâncime, superioritate",
    body: "Introdu principiile poziționale: lățime, adâncime și superioritate numerică. Lucrează pe unități (apărare–mijloc) în jocuri 7v7 cu zone marcate.",
    source: "Joc pozițional (Guardiola / La Masia)",
  },
  {
    bands: ["U13-U15"],
    theme: "Forța corectă",
    title: "Forța prin greutatea corpului",
    body: "La pubertate, prioritizează forța cu greutatea corpului și tehnica corectă (genuflexiuni, împingeri, core) înaintea greutăților. Previi accidentările și pregătești terenul.",
    source: "LTAD – faza „Train to Train”",
  },
  {
    bands: ["U13-U15"],
    theme: "Tranziții",
    title: "Cele 5 secunde de aur",
    body: "Antrenează cele 5 secunde după pierderea sau recuperarea mingii. Jocurile care premiază presingul imediat sau ieșirea rapidă din presiune dezvoltă cel mai modern aspect al jocului.",
    source: "Gegenpressing (Jürgen Klopp)",
  },
  {
    bands: ["U13-U15"],
    theme: "Scanning",
    title: "Privirea peste umăr",
    body: "Antrenează scanarea înainte de primire — numărul de „priviri peste umăr” se corelează cu performanța (studiile lui Geir Jordet). Folosește constrângeri care obligă jucătorul să se uite înainte de a primi.",
    source: "Cercetarea lui Geir Jordet",
  },
  {
    bands: ["U13-U15"],
    theme: "Analiză video scurtă",
    title: "Două minute de clipuri",
    body: "Arată 2–3 minute din meciul echipei. Vizualizarea propriilor decizii accelerează învățarea tactică mai mult decât orice prelegere de la tablă.",
    source: "Metodologie academii de top (Benfica/Ajax)",
  },

  // ── U16–U19 ────────────────────────────────────────────────────────────
  {
    bands: ["U16-U19"],
    theme: "Periodizare tactică",
    title: "Săptămâna în jurul jocului",
    body: "Structurează săptămâna în jurul principiilor de joc, nu doar al efortului fizic. Fiecare antrenament are o temă tactică legată de modelul de joc al echipei.",
    source: "Periodizare tactică (Vítor Frade)",
  },
  {
    bands: ["U16-U19"],
    theme: "Condiție specifică",
    title: "Condiția se câștigă cu mingea",
    body: "Înlocuiește alergările fără minge cu jocuri de mare intensitate care reproduc cerințele meciului. Astfel antrenezi simultan fizicul, tehnica și deciziile.",
    source: "Periodizare tactică modernă",
  },
  {
    bands: ["U16-U19"],
    theme: "Responsabilizare",
    title: "Lasă-i să propună soluții",
    body: "Implică jucătorii în analiză: lasă-i să propună soluții tactice. Autonomia crește motivația și înțelegerea la această vârstă de tranziție spre seniori.",
    source: "Leadership-ul academiei Ajax",
  },
  {
    bands: ["U16-U19"],
    theme: "Specializare pe post",
    title: "Claritate de rol",
    body: "Începe lucrul specific pe post: mișcări, profil fizic, decizii tipice. Tranziția spre seniori cere claritate de rol și repere clare pentru fiecare jucător.",
    source: "Academii de elită (City Football Group)",
  },
  {
    bands: ["U16-U19"],
    theme: "Recuperare",
    title: "Somnul este antrenament",
    body: "Educă jucătorii despre somn (8–9h) și nutriție. La performanță, recuperarea face parte din antrenament, nu este o opțiune. Un jucător odihnit învață și progresează mai repede.",
    source: "Știința sportivă (sport science)",
  },

  // ── Owner / academy leadership ─────────────────────────────────────────
  {
    bands: ["owner"],
    theme: "Filozofie unitară",
    title: "Un singur model de joc",
    body: "O academie de top are un model de joc comun de la U7 la U19. Asigură-te că toți antrenorii împărtășesc aceleași principii — copilul trebuie să recunoască jocul când urcă o grupă.",
    source: "Modelul La Masia",
  },
  {
    bands: ["owner"],
    theme: "Dezvoltarea antrenorilor",
    title: "Investește în antrenori",
    body: "Investește în antrenori, nu doar în jucători. O sesiune lunară de schimb de bune practici între antrenori ridică nivelul întregii academii.",
    source: "Filozofia Ajax (coach education)",
  },
  {
    bands: ["owner"],
    theme: "Drumul jucătorului",
    title: "Un „player pathway” vizibil",
    body: "Definește un drum clar al jucătorului: ce înseamnă să treci de la o grupă la alta. Claritatea motivează copiii și liniștește părinții.",
    source: "Academii de elită (player pathway)",
  },
  {
    bands: ["owner"],
    theme: "Părinții ca aliați",
    title: "Comunică dezvoltarea, nu doar rezultatul",
    body: "Comunică des cu părinții despre dezvoltarea copilului, nu doar despre rezultate. Părinții informați devin susținători, nu o sursă de presiune.",
    source: "Bune practici cluburi de formare",
  },
  {
    bands: ["owner"],
    theme: "Dezvoltare peste trofee",
    title: "Calitate înaintea victoriei U10",
    body: "Măsoară succesul prin dezvoltarea individuală, nu prin trofee la vârste mici. Cele mai bune academii sacrifică victoria de azi pentru jucătorul de mâine.",
    source: "Filozofia academiilor de top",
  },
];

export function tipsForBand(band: AgeBand): CoachingTip[] {
  return COACHING_TIPS.filter((t) => t.bands.includes(band));
}

/** Deterministic rotation so the same band gets a different tip each day. */
export function pickTip(band: AgeBand, dayIndex: number): CoachingTip {
  const pool = tipsForBand(band);
  if (pool.length === 0) return COACHING_TIPS[0];
  const i = ((dayIndex % pool.length) + pool.length) % pool.length;
  return pool[i];
}
