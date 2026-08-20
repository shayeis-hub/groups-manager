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
  { name: "בדיקה", email: "shay@leptin4life.com" }, // TEMP for verification, will be removed
];

export function isDietitianEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return DIETITIANS.some((d) => d.email.toLowerCase() === email.toLowerCase());
}
