// Access-control allowlist for the dietitian search interface (app/page.tsx
// routes any signed-in user whose email is listed here to <DietitianSearch/>
// instead of the normal owner UI). This must be mirrored — same emails — in
// the isDietitian() function in the Firestore security rules, since this
// client-side list is only a UI convenience: the real enforcement lives in
// the rules. An empty list means nobody has dietitian access yet.
export interface Dietitian {
  name: string;
  email: string;
}

export const DIETITIANS: Dietitian[] = [
  { name: "גלית", email: "galit.g@leptin4life.com" },
  { name: "רותם", email: "rotem.st@leptin4life.com" },
  { name: "שי (אישי)", email: "shayeis@gmail.com" },
];

export function isDietitianEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DIETITIANS.some((d) => d.email.toLowerCase() === email.toLowerCase());
}

// Short Hebrew name for a dietitian by email — used to label who logged a
// session (e.g. "רותם" instead of a full Google display name).
export function dietitianNameByEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = DIETITIANS.find((d) => d.email.toLowerCase() === email.toLowerCase());
  return match ? match.name : null;
}
