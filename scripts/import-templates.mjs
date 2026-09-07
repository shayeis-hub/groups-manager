// One-off bulk import: turns a local folder of week-numbered videos into a
// proper Template Set + Message Templates in Firestore, uploading each video
// to Storage exactly once at a deterministic path (idempotent — safe to
// re-run, never creates duplicates).
//
// Usage:
//   node scripts/import-templates.mjs <ProgramFolderName> <ProgramLabel>
// Example:
//   node scripts/import-templates.mjs START Start
//
// Expects source files at D:\video\<ProgramFolderName>\<קיץ|חורף>\*.mp4,
// each named like "בסיס - שבוע 3 - פתיחה.mp4" (week number + פתיחה/סיום
// anywhere in the name — spacing/dash variations are tolerated).

import { readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const __dirname = dirname(fileURLToPath(import.meta.url));

const COACH_UID = "TO0QQjo4asc4yD8Mlo2C0AsXcLj2"; // shay@leptin4life.com
const SEASONS = ["קיץ", "חורף"];
const VIDEO_ROOT = "D:\\video";

const [, , programFolder, programLabel] = process.argv;
if (!programFolder || !programLabel) {
  console.error("Usage: node scripts/import-templates.mjs <ProgramFolderName> <ProgramLabel>");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  await import("fs/promises").then((fs) =>
    fs.readFile(join(__dirname, "..", ".secrets", "service-account.json"), "utf8")
  )
);

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "group-manager-631d1.firebasestorage.app",
});

const db = getFirestore(app);
const bucket = getStorage(app).bucket();

// Parses "בסיס - שבוע 3 - פתיחה.mp4" / "שבוע 5- סיום.mp4" / "שבוע 3 פתיחה.mp4"
// into { week: 3, kind: "פתיחה" }. Tolerant of missing/odd spacing around
// the dash since the source files aren't perfectly consistent.
function parseFileName(name) {
  const m = name.match(/שבוע\s*(\d+)\s*-?\s*(פתיחה|סיום)/);
  if (!m) return null;
  return { week: Number(m[1]), kind: m[2] };
}

const KIND_DAY = { "פתיחה": 0, "סיום": 4 }; // Sunday / Thursday
const KIND_SLUG = { "פתיחה": "opening", "סיום": "closing" };

async function ensureTemplateSet(name, program) {
  const existing = await db
    .collection("templateSets")
    .where("uid", "==", COACH_UID)
    .where("program", "==", program)
    .where("name", "==", name)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;

  const ref = await db.collection("templateSets").add({
    uid: COACH_UID,
    name,
    program,
    createdAt: Date.now(),
  });
  console.log(`  + created template set "${name}" (${program}) -> ${ref.id}`);
  return ref.id;
}

async function ensureTemplate({ setId, week, kind, storagePath, size, originalName }) {
  const name = `${kind} שבוע ${week}`;
  const existing = await db
    .collection("messageTemplates")
    .where("uid", "==", COACH_UID)
    .where("setId", "==", setId)
    .where("weekOffset", "==", week)
    .where("name", "==", name)
    .limit(1)
    .get();

  const attachment = { path: storagePath, name: originalName, type: "video/mp4" };

  if (!existing.empty) {
    await existing.docs[0].ref.update({ attachment });
    console.log(`    = template "${name}" already existed, refreshed attachment`);
    return;
  }

  await db.collection("messageTemplates").add({
    uid: COACH_UID,
    setId,
    name,
    weekOffset: week,
    dayOfWeek: KIND_DAY[kind],
    text: "",
    attachment,
    createdAt: Date.now(),
  });
  console.log(`    + template "${name}" created (${(size / 1024 / 1024).toFixed(1)}MB)`);
}

async function uploadIfMissing(localPath, storagePath) {
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (exists) {
    console.log(`    (already uploaded, skipping) ${storagePath}`);
    return;
  }
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType: "video/mp4" },
  });
  console.log(`    uploaded -> ${storagePath}`);
}

async function run() {
  for (const season of SEASONS) {
    const dir = join(VIDEO_ROOT, programFolder, season);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      console.log(`(skipping, folder not found: ${dir})`);
      continue;
    }

    console.log(`\n== ${programLabel} / ${season} (${dir}) ==`);
    const setId = await ensureTemplateSet(season, programLabel);

    for (const fileName of files) {
      const parsed = parseFileName(fileName);
      if (!parsed) {
        console.log(`  ! could not parse "${fileName}", skipping`);
        continue;
      }
      const localPath = join(dir, fileName);
      const size = statSync(localPath).size;
      const storagePath = `template-attachments/${COACH_UID}/${programLabel}/${season}/week-${parsed.week}-${KIND_SLUG[parsed.kind]}.mp4`;

      console.log(`  ${fileName} -> שבוע ${parsed.week}, ${parsed.kind}`);
      await uploadIfMissing(localPath, storagePath);
      await ensureTemplate({
        setId,
        week: parsed.week,
        kind: parsed.kind,
        storagePath,
        size,
        originalName: fileName,
      });
    }
  }

  console.log("\nDone.");
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
