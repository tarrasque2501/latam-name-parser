import fs from "fs";
import path from "path";
import readline from "readline";

interface CountryConfig {
  mode: "extract" | "generate";
  inputDir: string;
  outputDir: string;
  filePattern?: RegExp;
  encoding?: BufferEncoding;
  skipHeader?: boolean;
  parseLine?: (line: string, index: number) => TestRecord | null;
  targetRecords?: number;
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

class ShardedSet {
  private shards: Set<string>[];

  constructor(shardCount = 16) {
    this.shards = Array.from({ length: shardCount }, () => new Set<string>());
  }

  add(value: string) {
    this.shards[this.hash(value)].add(value);
  }

  has(value: string) {
    return this.shards[this.hash(value)].has(value);
  }

  private hash(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % this.shards.length;
  }
}

const STRATEGIES: Record<string, CountryConfig> = {
  cr: {
    mode: "extract",
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
    mode: "extract",
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
  ar: {
    mode: "generate",
    inputDir: path.join(DATA_ROOT, "ar"),
    outputDir: path.join(DATA_ROOT, "test/ar"),
    targetRecords: 14667320,
  },
};

async function generateTester() {
  const countryCode = process.argv[2]?.toLowerCase();
  const config = STRATEGIES[countryCode];

  if (!config) {
    console.error("   Error: Debes especificar un país válido.");
    console.error(
      "   Uso: npx ts-node src/tools/generate-testing.ts <cr|mx|ar>",
    );
    return;
  }

  console.log(
    `\n  INICIANDO MODO [${config.mode.toUpperCase()}] PARA: [${countryCode.toUpperCase()}]`,
  );
  console.log(`  Input: ${config.inputDir}`);
  console.log(`  Output: ${config.outputDir}`);

  if (!fs.existsSync(config.inputDir)) {
    console.error(`  Directorio de entrada no encontrado: ${config.inputDir}`);
    return;
  }

  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  } else {
    const oldFiles = fs
      .readdirSync(config.outputDir)
      .filter((f) => f.startsWith("test_part_"));
    console.log(`  Limpiando ${oldFiles.length} archivos antiguos...`);
    for (const f of oldFiles) fs.unlinkSync(path.join(config.outputDir, f));
  }

  if (config.mode === "extract") {
    await runExtraction(config);
  } else if (config.mode === "generate" && countryCode === "ar") {
    await runArGeneration(config);
  }
}

async function runExtraction(config: CountryConfig) {
  const files = fs
    .readdirSync(config.inputDir)
    .filter((f) => config.filePattern!.test(f))
    .sort();
  if (files.length === 0) {
    console.error(`  No hay archivos válidos en ${config.inputDir}`);
    return;
  }

  let currentFileIndex = 1;
  let currentRecordsInFile = 0;
  let totalProcessed = 0;
  let totalIgnoredDuplicates = 0;
  const seenNames = new ShardedSet();

  let writeStream = createWriteStream(config.outputDir, currentFileIndex);
  writeStream.write("[\n");

  for (const file of files) {
    console.log(`  Procesando: ${file}...`);
    const fileStream = fs.createReadStream(path.join(config.inputDir, file), {
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

      const record = config.parseLine!(line, lineIdx);
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
      const canWrite = writeStream.write(comma + JSON.stringify(record));
      currentRecordsInFile++;

      if (!canWrite) {
        await new Promise((resolve) => writeStream.once("drain", resolve));
      }

      if (currentRecordsInFile >= RECORDS_PER_FILE) {
        writeStream.write("\n]");
        writeStream.end();
        console.log(
          `     Guardado test_part_${currentFileIndex}.json (${RECORDS_PER_FILE.toLocaleString()} registros)`,
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
    `     Guardado test_part_${currentFileIndex}.json (${currentRecordsInFile.toLocaleString()} registros)`,
  );
  printSummary(totalProcessed, totalIgnoredDuplicates);
}

async function runArGeneration(config: CountryConfig) {
  const namesFile = path.join(config.inputDir, "historico-nombres.csv");
  const surnamesFile = path.join(
    config.inputDir,
    "apellidos_cantidad_personas_provincia.csv",
  );

  if (!fs.existsSync(namesFile) || !fs.existsSync(surnamesFile)) {
    console.error(`  Faltan archivos base en ${config.inputDir}.`);
    return;
  }

  console.log("  Cargando diccionarios a memoria (Modo Ultra-Rápido)...");

  const loadCsvColumn = async (filePath: string, colIndex: number) => {
    const dataSet = new Set<string>();
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });
    let isFirst = true;
    for await (const line of rl) {
      if (isFirst) {
        isFirst = false;
        continue;
      }
      const parts = line.split(",");
      const val = parts[colIndex]?.trim().replace(/"/g, "").toUpperCase();
      if (val) dataSet.add(val);
    }
    return Array.from(dataSet);
  };

  const names = await loadCsvColumn(namesFile, 0);
  const surnames = await loadCsvColumn(surnamesFile, 0);

  console.log(
    `  Diccionarios listos: ${names.length.toLocaleString()} Nombres | ${surnames.length.toLocaleString()} Apellidos`,
  );
  console.log(`   Generando combinaciones aleatorias...`);

  let currentFileIndex = 1;
  let currentRecordsInFile = 0;
  let totalProcessed = 0;
  let totalIgnoredDuplicates = 0;

  const seenNames = new ShardedSet();

  let writeStream = createWriteStream(config.outputDir, currentFileIndex);
  writeStream.write("[\n");

  const target = config.targetRecords || 20000000;

  while (totalProcessed < target) {
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomSurname = surnames[Math.floor(Math.random() * surnames.length)];

    const nombreCompleto = `${randomName} ${randomSurname}`.trim();

    if (seenNames.has(nombreCompleto)) {
      totalIgnoredDuplicates++;
      continue;
    }

    seenNames.add(nombreCompleto);

    const record: TestRecord = {
      id: `AR_${totalProcessed + 1}`,
      nombreCompleto,
      nombre: randomName,
      apellido1: randomSurname,
      apellido2: "",
    };

    totalProcessed++;

    const comma = currentRecordsInFile === 0 ? "" : ",\n";
    const canWrite = writeStream.write(comma + JSON.stringify(record));
    currentRecordsInFile++;

    if (!canWrite) {
      await new Promise((resolve) => writeStream.once("drain", resolve));
    }

    if (currentRecordsInFile >= RECORDS_PER_FILE) {
      writeStream.write("\n]");
      writeStream.end();
      console.log(
        `     Guardado test_part_${currentFileIndex}.json (${RECORDS_PER_FILE.toLocaleString()} registros)`,
      );

      currentFileIndex++;
      currentRecordsInFile = 0;

      if (totalProcessed < target) {
        writeStream = createWriteStream(config.outputDir, currentFileIndex);
        writeStream.write("[\n");
      }
    }
  }

  if (currentRecordsInFile > 0) {
    writeStream.write("\n]");
    writeStream.end();
    console.log(
      `   Guardado test_part_${currentFileIndex}.json (${currentRecordsInFile.toLocaleString()} registros)`,
    );
  }

  printSummary(totalProcessed, totalIgnoredDuplicates);
}
function createWriteStream(dir: string, index: number) {
  return fs.createWriteStream(path.join(dir, `test_part_${index}.json`), {
    encoding: "utf-8",
  });
}

function printSummary(processed: number, duplicates: number) {
  console.log(`\n  PROCESO TERMINADO  `);
  console.log(`   Total Nombres Únicos: ${processed.toLocaleString()}`);
  console.log(`   Duplicados Ignorados: ${duplicates.toLocaleString()}`);
}

generateTester();
