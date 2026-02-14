import fs from "fs";
import path from "path";
import readline from "readline";

const INPUT_DIR = path.join(__dirname, "../../src/data/cr");
const TEST_OUTPUT_DIR = path.join(__dirname, "../../src/data/test/cr");
const RECORDS_PER_FILE = 1000000;

async function generateTester() {
  console.log("INICIANDO GENERACIÓN OPTIMIZADA (STREAMING INVERSO)...");

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Directorio no encontrado: ${INPUT_DIR}`);
    return;
  }
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numB - numA;
    });

  console.log(`Archivos ordenados por prioridad (recientes primero):`, files);
  const seenCedulas = new Set<string>();

  if (!fs.existsSync(TEST_OUTPUT_DIR)) {
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  }

  const oldFiles = fs.readdirSync(TEST_OUTPUT_DIR);
  for (const f of oldFiles) {
    if (f.endsWith(".json")) fs.unlinkSync(path.join(TEST_OUTPUT_DIR, f));
  }

  let currentFileIndex = 1;
  let currentRecordsInFile = 0;
  let totalUniqueProcessed = 0;

  let writeStream = fs.createWriteStream(
    path.join(TEST_OUTPUT_DIR, `test_part_${currentFileIndex}.json`),
    { encoding: "utf-8" },
  );
  writeStream.write("[\n");

  console.log(`Comenzando escritura directa...`);

  for (const file of files) {
    const filePath = path.join(INPUT_DIR, file);
    console.log(`Procesando: ${file} (Ignorando duplicados ya vistos)...`);
    const fileStream = fs.createReadStream(filePath, { encoding: "latin1" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (let line of rl) {
      if (!line || line.length < 10) continue;
      const parts = line.split(",");
      if (parts.length < 8) continue;
      const cedula = parts[0].trim();
      if (seenCedulas.has(cedula)) {
        continue;
      }
      const nombre = parts[5]?.trim();
      const ap1 = parts[6]?.trim();
      const ap2 = parts[7]?.trim();
      if (!cedula || !nombre || /^\d+$/.test(nombre)) continue;
      seenCedulas.add(cedula);
      totalUniqueProcessed++;
      const record = {
        cedula,
        nombre,
        apellido1: ap1,
        apellido2: ap2,
        nombreCompleto: `${nombre} ${ap1} ${ap2}`.trim(),
      };
      const comma = currentRecordsInFile === 0 ? "" : ",\n";
      const success = writeStream.write(comma + JSON.stringify(record));
      if (!success) {
      }
      currentRecordsInFile++;
      if (currentRecordsInFile >= RECORDS_PER_FILE) {
        writeStream.write("\n]");
        writeStream.end();
        console.log(
          `Cerrado: test_part_${currentFileIndex}.json (${RECORDS_PER_FILE.toLocaleString()} registros)`,
        );

        currentFileIndex++;
        currentRecordsInFile = 0;
        writeStream = fs.createWriteStream(
          path.join(TEST_OUTPUT_DIR, `test_part_${currentFileIndex}.json`),
          { encoding: "utf-8" },
        );
        writeStream.write("[\n");
      }
    }
  }

  writeStream.write("\n]");
  writeStream.end();
  console.log(
    `Cerrado: test_part_${currentFileIndex}.json (${currentRecordsInFile.toLocaleString()} registros)`,
  );

  console.log(`\nPROCESO TERMINADO CON ÉXITO.`);
  console.log(
    `Total Personas Únicas: ${totalUniqueProcessed.toLocaleString()}`,
  );
  console.log(`Archivos Generados: ${currentFileIndex}`);
}

generateTester();
