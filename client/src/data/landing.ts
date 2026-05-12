/**
 * Static landing content used by the public discovery flow.
 *
 * Phase 1 reads this directly. Phase 5 (Owner Admin) replaces the Owner /
 * Trainers / Players slot data with rows pulled from Supabase
 * (`landing_content` + `trainers` + `children` aggregates).
 *
 * Romanian-first copy, intentional and confident.
 */

export type Reason = {
  title: string;
  body: string;
  /** Optional bullet points shown beneath the body when more depth is needed. */
  details?: string[];
};

export type Owner = {
  name: string;
  role: string;
  quote: string;
  reasons: Reason[];
  stats: { label: string; value: string }[];
};

export type Trainer = {
  id: string;
  name: string;
  position: string;
  ageMin: number;
  ageMax: number;
  bio: string;
  certifications: string[];
  initials: string;
  accent: "cyan" | "gold" | "navy";
  /** Optional portrait video that replaces the initials placeholder. */
  videoSrc?: string;
  /** Pre-rendered freeze frame (best frame near the end of the clip). */
  posterSrc?: string;
  /** Specialty areas — what this trainer is known for at the academy. */
  focus?: string[];
  /**
   * WhatsApp phone number in international E.164 format (e.g. "+40744311147").
   * Undefined means "not yet configured" — the UI renders a disabled
   * "Vine în curând" placeholder instead of an active WhatsApp pill.
   * Will be editable through the admin dashboard (workstream E).
   */
  whatsapp?: string;
};

export type Player = {
  id: string;
  name: string;
  position: string;
  yearOfBirth: number;
};

export type AgeGroup = {
  code: string;
  label: string;
  ageMin: number;
  ageMax: number;
  description: string;
  trainerIds: string[];
  childCount: number;
  /** Weekly training schedule shown on the group card. */
  schedule?: string;
  /** Short focus bullets — what the group works on day to day. */
  highlights?: string[];
  /** Sample roster shown on the public card. The remaining children
   *  (childCount − players.length) appear as a "+ N alți copii" badge. */
  players?: Player[];
};

export const OWNER: Owner = {
  name: "Dan Matei",
  role: "Fondator & Antrenor Principal",
  quote:
    "Fotbalul nu este doar un joc. Este școala unde copiii învață ce este caracterul, disciplina și respectul în echipă, aceste lucruri îi vor ajuta în viață.",
  reasons: [
    {
      title: "Antrenori cu Licență UEFA",
      body: "Echipa este formată exclusiv din antrenori certificați UEFA, cu experiență directă în fotbalul de performanță. Fiecare grupă este coordonată de un specialist pe categoria de vârstă, nu de un antrenor generalist.",
      details: [
        "3 antrenori cu licență recunoscute internațional",
        "Toți au jucat fotbal profesionist sau semi-profesionist înainte de a forma copii",
        "Specializări complementare: tehnică, tactică, pregătire fizică și prim-ajutor pediatric",
        "Curs anual de actualizare metodologică, conform standardului FRF & UEFA",
        "Raport antrenor–copii de 1 la 14, cu evaluări biannuale și rapoarte lunare către părinți",
      ],
    },
    {
      title: "Grupe pe vârste, atenție individuală",
      body: "Grupe mici, structurate pe categoria de vârstă, plus competiție reală în fiecare săptămână. Așa creștem jucători, nu doar copii care aleargă după minge.",
      details: [
        "Maxim 14 copii per grupă, antrenamente adaptate fiecărei categorii de vârstă",
        "Toți copiii sunt înscriși în campionat oficial și joacă câte un meci pe săptămână",
        "Meciurile săptămânale dezvoltă mentalitatea de competiție, gestionarea emoțiilor și gândirea tactică în timp real",
        "Fiecare copil are obiective individuale clare și un plan de progres urmărit lună de lună",
        "Rapoarte lunare către părinți: progres tehnic, atitudine, prezență și recomandări specifice",
      ],
    },
    {
      title: "Educație, nu doar sport",
      body: "Lucrăm pe încredere, fair-play și respect. Notele de la școală contează la fel ca golul marcat sâmbătă. Antrenorii sunt mentori înainte de a fi instructori — fiecare ședință include un moment de reflecție despre comportament, ambiție și progres personal. Părinții sunt parte din proces: întâlniri trimestriale și o cultură comună în care disciplina din clasă și performanța din teren cresc împreună.",
    },
    {
      title: "Bază sportivă proprie, lângă casă",
      body: "Baza Sportivă Mănăștur, Cluj-Napoca. Antrenamente luni–vineri 16:00–19:00, gazon profesional și vestiar dedicat.",
    },
  ],
  stats: [
    { label: "Din", value: "2017" },
    { label: "Copii formați", value: "240+" },
    { label: "Trofee", value: "18" },
    { label: "Antrenori UEFA", value: "3" },
  ],
};

export const TRAINERS: Trainer[] = [
  {
    id: "t-kelemen",
    name: "Kelemen Andrei",
    position: "Antrenor U10–U13",
    ageMin: 10,
    ageMax: 13,
    bio: "Specializat în dezvoltarea tehnicii individuale și a citirii jocului. Lucrează pe poziționare, comunicare și fundamentele jocului colectiv.",
    certifications: ["UEFA C", "Antrenor Federal"],
    initials: "KA",
    accent: "cyan",
    videoSrc: "/Kely.mp4",
    posterSrc: "/Kely-poster.jpg",
    focus: ["Tehnică individuală", "Citire de joc", "Comunicare în teren"],
    whatsapp: "+40770922965",
  },
  {
    id: "t-sopi",
    name: "Răzvan Soporan",
    position: "Antrenor U7–U9",
    ageMin: 7,
    ageMax: 9,
    bio: "Specializat pe grupele mici. Aduce copiii în fotbal prin joc, mișcare și încredere — fără presiune, fără competiție timpurie.",
    certifications: ["UEFA C", "Prim ajutor pediatric"],
    initials: "RS",
    accent: "cyan",
    videoSrc: "/Sopi.mp4",
    posterSrc: "/Sopi-poster.jpg",
    focus: [
      "Coordonare prin joc",
      "Primul contact cu mingea",
      "Încredere și ritm",
    ],
  },
  {
    id: "t-dan",
    name: "Dan Matei",
    position: "Antrenor Principal & Fondator",
    ageMin: 7,
    ageMax: 15,
    bio: "Fondatorul școlii și mentorul echipei tehnice. Coordonează toate grupele și se implică direct în formarea jucătorilor — de la cele mai mici vârste până la juniori.",
    certifications: ["UEFA B", "Licență FRF", "Antrenor Principal"],
    initials: "DM",
    accent: "cyan",
    videoSrc: "/TheBoss.mp4",
    posterSrc: "/TheBoss-poster.jpg",
    focus: [
      "Coordonare echipă tehnică",
      "Sistem tactic complet",
      "Mentorat juniori",
    ],
    whatsapp: "+40744311147",
  },
];

export const AGE_GROUPS: AgeGroup[] = [
  {
    code: "U7",
    label: "U6 – U7",
    ageMin: 5,
    ageMax: 7,
    description:
      "Inițiere prin joc. Coordonare, echilibru, primul contact cu mingea.",
    trainerIds: ["t-sopi"],
    childCount: 22,
    schedule: "Marți & Joi · 16:00–17:00",
    highlights: [
      "Joc liber și mișcare ghidată, fără presiune competitivă",
      "Coordonare bilaterală, echilibru și ritm cu mingea",
      "Reguli simple, prietenii noi și plăcerea de a veni la antrenament",
    ],
    players: [
      {
        id: "p-u7-1",
        name: "Luca Pop",
        position: "Atacant",
        yearOfBirth: 2020,
      },
      {
        id: "p-u7-2",
        name: "Matei Crișan",
        position: "Mijlocaș",
        yearOfBirth: 2020,
      },
      {
        id: "p-u7-3",
        name: "Tudor Marincu",
        position: "Apărare",
        yearOfBirth: 2019,
      },
    ],
  },
  {
    code: "U9",
    label: "U8 – U9",
    ageMin: 8,
    ageMax: 9,
    description:
      "Tehnica de bază: pasare, conducere, control. Joc 5×5 cu reguli simple.",
    trainerIds: ["t-sopi"],
    childCount: 28,
    schedule: "Luni, Miercuri & Vineri · 16:00–17:30",
    highlights: [
      "Tehnică individuală: pasare, conducere de minge, control orientat",
      "Primele meciuri 5×5 cu reguli simple și roluri rotative",
      "Înscriere în campionatul județean U9 cu un meci pe săptămână",
    ],
    players: [
      {
        id: "p-u9-1",
        name: "David Pîrvulescu",
        position: "Atacant",
        yearOfBirth: 2018,
      },
      {
        id: "p-u9-2",
        name: "Andrei Mureșan",
        position: "Mijlocaș",
        yearOfBirth: 2018,
      },
      {
        id: "p-u9-3",
        name: "Mihai Gavrilă",
        position: "Portar",
        yearOfBirth: 2017,
      },
    ],
  },
  {
    code: "U11",
    label: "U10 – U11",
    ageMin: 10,
    ageMax: 11,
    description: "Joc 7×7. Poziționare, comunicare, primele scheme tactice.",
    trainerIds: ["t-kelemen"],
    childCount: 26,
    schedule: "Luni–Vineri · 17:00–18:30",
    highlights: [
      "Joc 7×7, poziționare pe teren și comunicare în atac și apărare",
      "Primele scheme tactice: presing pe purtătorul de minge, dublaje",
      "Meci oficial săptămânal în campionat și turnee județene",
    ],
    players: [
      {
        id: "p-u11-1",
        name: "Răzvan Stanciu",
        position: "Atacant",
        yearOfBirth: 2016,
      },
      {
        id: "p-u11-2",
        name: "Ștefan Moldovan",
        position: "Mijlocaș central",
        yearOfBirth: 2015,
      },
      {
        id: "p-u11-3",
        name: "Vlad Crăciun",
        position: "Fundaș lateral",
        yearOfBirth: 2016,
      },
    ],
  },
  {
    code: "U13",
    label: "U12 – U13",
    ageMin: 12,
    ageMax: 13,
    description: "Joc 9×9. Tactică pe posturi, citire de joc, condiție fizică.",
    trainerIds: ["t-kelemen", "t-dan"],
    childCount: 24,
    schedule: "Luni–Vineri · 17:30–19:00",
    highlights: [
      "Joc 9×9 cu specializare pe posturi și citire de joc",
      "Pregătire fizică structurată: viteză, rezistență, mobilitate",
      "Pregătire pentru selecții la centrele de juniori",
    ],
    players: [
      {
        id: "p-u13-1",
        name: "Cristian Bolba",
        position: "Atacant",
        yearOfBirth: 2014,
      },
      {
        id: "p-u13-2",
        name: "Sergiu Pop",
        position: "Mijlocaș defensiv",
        yearOfBirth: 2013,
      },
      {
        id: "p-u13-3",
        name: "Bogdan Lupu",
        position: "Portar",
        yearOfBirth: 2013,
      },
    ],
  },
  {
    code: "U15",
    label: "U14 – U15",
    ageMin: 14,
    ageMax: 15,
    description:
      "Joc 11×11. Pregătire pentru centre de juniori și competiții județene.",
    trainerIds: ["t-dan"],
    childCount: 18,
    schedule: "Luni–Vineri · 18:00–19:30",
    highlights: [
      "Joc 11×11 cu sistem tactic complet și schimbări de strategie",
      "Mentalitate de competiție și gestionarea presiunii în meci",
      "Drum direct spre Liga de juniori și centrele de performanță",
    ],
    players: [
      {
        id: "p-u15-1",
        name: "Alexandru Cosma",
        position: "Atacant central",
        yearOfBirth: 2012,
      },
      {
        id: "p-u15-2",
        name: "Iulian Mureșan",
        position: "Mijlocaș ofensiv",
        yearOfBirth: 2011,
      },
      {
        id: "p-u15-3",
        name: "Filip Berariu",
        position: "Fundaș central",
        yearOfBirth: 2011,
      },
    ],
  },
];

export const HERO_REDIRECT_MS = 10000;
