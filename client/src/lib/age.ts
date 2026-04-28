/**
 * DOB / age helpers shared by signup, child profile, and admin re-match.
 *
 *   currentAge('2017-05-14')   → number (years)
 *   ageGroupLabel(7)           → "U7–U9"
 *   matchTrainers(age, list)   → trainers whose [age_min, age_max] contains age
 */

export function currentAge(
  dob: string | Date,
  today: Date = new Date()
): number {
  const d = typeof dob === "string" ? new Date(dob) : dob;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

export function ageGroupLabel(age: number): string {
  if (age <= 7) return "U6–U7";
  if (age <= 9) return "U8–U9";
  if (age <= 11) return "U10–U11";
  if (age <= 13) return "U12–U13";
  if (age <= 15) return "U14–U15";
  return "Seniori";
}

export type TrainerCandidate = {
  id: string;
  age_min: number;
  age_max: number;
  active: boolean;
  display_order: number;
};

export function matchTrainers<T extends TrainerCandidate>(
  age: number,
  trainers: T[]
): T[] {
  return trainers
    .filter(t => t.active && age >= t.age_min && age <= t.age_max)
    .sort((a, b) => a.display_order - b.display_order);
}

/** Format a date for the "Istoric" timeline. */
export function formatTimelineDate(iso: string, locale = "ro-RO"): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
