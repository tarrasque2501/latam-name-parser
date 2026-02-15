import fs from "fs";
import path from "path";
import readline from "readline";

interface CountryConfig {
  inputDir: string;
  outputDir: string;
  filePattern: RegExp;
  encoding: BufferEncoding;
  skipHeader: boolean;
  parseLine: (line: string, index: number) => TestRecord | null;
}

interface TestRecord {
  id: string;
  nombreCompleto: string;
  nombre: string;
  apellido1: string;
  apellido2: string;
}

const RECORDS_PER_FILE = 1000000;
const DATA_ROOT = path.join(__dirname, "../../src/data");

const STRATEGIES: Record<string, CountryConfig> = {
  cr: {
    inputDir: path.join(DATA_ROOT, "cr"),
    outputDir: path.join(DATA_ROOT, "test/cr"),
    filePattern: /\.txt$/,
    encoding: "latin1",
    skipHeader: false,
    parseLine: (line) => {
      const parts = line.split(",");
      if (parts.length < 8) return null;

      const cedula = parts[0].trim();
      const nombre = parts[5]?.trim();
      const ap1 = parts[6]?.trim();
      const ap2 = parts[7]?.trim();

      if (!cedula || !nombre || /^\d+$/.test(nombre)) return null;

      return {
        id: cedula,
        nombreCompleto: `${nombre} ${ap1} ${ap2}`.trim(),
        nombre,
        apellido1: ap1,
        apellido2: ap2,
      };
    },
  },
  mx: {
    inputDir: path.join(DATA_ROOT, "mx"),
    outputDir: path.join(DATA_ROOT, "test/mx"),
    filePattern: /\.csv$/i,
    encoding: "utf-8",
    skipHeader: true,
    parseLine: (line, idx) => {
      const parts = line.split(",");

      if (parts.length < 6) return null;

      const id = parts[0]?.trim() || `MX_${idx}`;
      const ap1 = parts[3]?.trim().replace(/"/g, "") || "";
      const ap2 = parts[4]?.trim().replace(/"/g, "") || "";
      const nombre = parts[5]?.trim().replace(/"/g, "") || "";

      if (!nombre || nombre === "NOMBRE") return null;

      return {
        id,
        nombreCompleto: `${nombre} ${ap1} ${ap2}`.trim(),
        nombre,
        apellido1: ap1,
        apellido2: ap2,
      };
    },
  },
};

async function generateTester() {
  const countryCode = process.argv[2]?.toLowerCase();
  const config = STRATEGIES[countryCode];

  if (!config) {
    console.error("   Error: Debes especificar el país.");
    console.error("   Uso: npx ts-node src/tools/generate-testing.ts <cr|mx>");
    return;
  }

  console.log(
    `INICIANDO GENERACIÓN DE DATASETS ÚNICOS: [${countryCode.toUpperCase()}]`,
  );
  console.log(`Input: ${config.inputDir}`);
  console.log(`Output: ${config.outputDir}`);

  if (!fs.existsSync(config.inputDir)) {
    console.error(`Directorio de entrada no encontrado: ${config.inputDir}`);
    return;
  }

  const files = fs
    .readdirSync(config.inputDir)
    .filter((f) => config.filePattern.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No hay archivos válidos en ${config.inputDir}`);
    return;
  }

  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  } else {
    const oldFiles = fs
      .readdirSync(config.outputDir)
      .filter((f) => f.startsWith("test_part_"));
    console.log(`Limpiando ${oldFiles.length} archivos antiguos...`);
    for (const f of oldFiles) fs.unlinkSync(path.join(config.outputDir, f));
  }

  let currentFileIndex = 1;
  let currentRecordsInFile = 0;
  let totalProcessed = 0;
  let totalIgnoredDuplicates = 0;

  const seenNames = new Set<string>();

  let writeStream = createWriteStream(config.outputDir, currentFileIndex);
  writeStream.write("[\n");

  for (const file of files) {
    const filePath = path.join(config.inputDir, file);
    console.log(`Procesando: ${file}...`);

    const fileStream = fs.createReadStream(filePath, {
      encoding: config.encoding,
    });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isHeader = true;
    let lineIdx = 0;

    for await (const line of rl) {
      lineIdx++;

      if (config.skipHeader && isHeader) {
        isHeader = false;
        continue;
      }

      const record = config.parseLine(line, lineIdx);
      if (!record) continue;
      const uniqueKey = record.nombreCompleto
        .replace(/\s+/g, " ")
        .toUpperCase();

      if (seenNames.has(uniqueKey)) {
        totalIgnoredDuplicates++;
        continue;
      }

      seenNames.add(uniqueKey);
      totalProcessed++;

      const comma = currentRecordsInFile === 0 ? "" : ",\n";
      writeStream.write(comma + JSON.stringify(record));
      currentRecordsInFile++;

      if (currentRecordsInFile >= RECORDS_PER_FILE) {
        writeStream.write("\n]");
        writeStream.end();
        console.log(
          `   Guardado test_part_${currentFileIndex}.json (${RECORDS_PER_FILE.toLocaleString()} registros)`,
        );

        currentFileIndex++;
        currentRecordsInFile = 0;
        writeStream = createWriteStream(config.outputDir, currentFileIndex);
        writeStream.write("[\n");
      }
    }
  }

  writeStream.write("\n]");
  writeStream.end();
  console.log(
    `   Guardado test_part_${currentFileIndex}.json (${currentRecordsInFile.toLocaleString()} registros)`,
  );

  console.log(`\nPROCESO TERMINADO.`);
  console.log(
    `   Total Nombres Únicos Generados: ${totalProcessed.toLocaleString()}`,
  );
  console.log(
    `   Duplicados Ignorados: ${totalIgnoredDuplicates.toLocaleString()}`,
  );
}

function createWriteStream(dir: string, index: number) {
  return fs.createWriteStream(path.join(dir, `test_part_${index}.json`), {
    encoding: "utf-8",
  });
}

generateTester();
