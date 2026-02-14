import fs from "fs";
import path from "path";
import readline from "readline";

const INPUT_DIR = path.join(__dirname, "../../src/data/cr");
const SURNAMES_FILE = path.join(__dirname, "../../src/data/surnames-cr.json");
const OUTPUT_NAMES_FILE = path.join(
  __dirname,
  "../../src/data/givenNames-cr.ts",
);
const MIN_NAME_FREQUENCY = 500;

async function trainModel() {
  console.log("INICIANDO ENTRENAMIENTO DEL MODELO (SOLO APRENDIZAJE)...");

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Directorio no encontrado: ${INPUT_DIR}`);
    return;
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".txt"));
  console.log(`Encontrados ${files.length} archivos para entrenar.`);
  const givenNameCounts = new Map<string, number>();
  const compoundSurnames = new Set<string>();

  if (fs.existsSync(SURNAMES_FILE)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(SURNAMES_FILE, "utf-8"));
      oldData.forEach((s: string) =>
        compoundSurnames.add(s.toUpperCase().trim()),
      );
    } catch (e) {}
  }

  let totalLines = 0;

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    console.log(`Leyendo: ${file}...`);
    const fileStream = fs.createReadStream(filePath, { encoding: "latin1" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (let line of rl) {
      if (!line || line.length < 10) continue;

      const parts = line.split(",");
      if (parts.length < 8) continue;

      const rawName = parts[5]?.trim();
      const rawAp1 = parts[6]?.trim();
      const rawAp2 = parts[7]?.trim();
      if (!rawName || /^\d+$/.test(rawName)) continue;

      totalLines++;

      const tokens = rawName.toUpperCase().split(/\s+/);
      tokens.forEach((token: string) => {
        if (
          token.length > 2 &&
          !["DEL", "LOS", "LAS", "SAN", "MARIA", "JOSE"].includes(token)
        ) {
          givenNameCounts.set(token, (givenNameCounts.get(token) || 0) + 1);
        }
      });

      [rawAp1, rawAp2].forEach((ap) => {
        if (ap && ap.includes(" ")) {
          compoundSurnames.add(ap.toUpperCase());
        }
      });
    }
  }

  console.log(
    `\nENTRENAMIENTO FINALIZADO (${totalLines.toLocaleString()} líneas analizadas)`,
  );

  const sortedNames = Array.from(givenNameCounts.entries())
    .filter(([_, count]) => count > MIN_NAME_FREQUENCY)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const namesContent = `
// Diccionario generado automáticamente
export const CR_GIVEN_NAMES = new Set<string>([
  ${sortedNames.map((n) => `"${n}"`).join(",\n  ")}
]);
`;
  fs.writeFileSync(OUTPUT_NAMES_FILE, namesContent);
  console.log(
    `Nombres actualizados en: ${OUTPUT_NAMES_FILE} (${sortedNames.length} nombres)`,
  );

  const sortedSurnames = Array.from(compoundSurnames).sort((a, b) => {
    const wordsA = a.split(" ").length;
    const wordsB = b.split(" ").length;
    return wordsB !== wordsA ? wordsB - wordsA : b.length - a.length;
  });

  fs.writeFileSync(SURNAMES_FILE, JSON.stringify(sortedSurnames, null, 2));
  console.log(
    `Apellidos actualizados en: ${SURNAMES_FILE} (${sortedSurnames.length} compuestos)`,
  );
}

trainModel();
