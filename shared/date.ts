type DateParts = { year: number; month: number; day: number };

export function dobParts(dob: string | Date): DateParts {
  if (typeof dob === "string") {
    const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
      };
    }
  }

  const d = typeof dob === "string" ? new Date(dob) : dob;
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function birthYearFromDob(dob: string | Date): number {
  return dobParts(dob).year;
}
