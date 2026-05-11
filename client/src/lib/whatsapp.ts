/**
 * Shared helper for building wa.me URLs across the public site.
 *
 * `phone` accepts any input format we might store ("+40 744 311 147",
 * "0744311147", "+40-744-311-147") and normalises it. Returns `null`
 * if the input is empty / unset — callers use that to render a
 * "Vine în curând" disabled state.
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message?: string,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  const base = `https://wa.me/${digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** Default greeting used when a parent taps a trainer's WhatsApp button. */
export function defaultParentToTrainerGreeting(trainerName: string): string {
  return `Bună, ${trainerName}! Sunt părintele unui copil interesat de Academia Dan Matei. Aș dori să vorbim despre înscriere/programare.`;
}

/** Human-readable formatting: "+40 744 311 147". */
export function formatRoPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("40") && digits.length === 11) {
    return `+40 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return phone;
}
