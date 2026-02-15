import fs from "fs";
import path from "path";
import readline from "readline";
import { performance } from "perf_hooks";
import { LatamNameParser, Dictionaries } from "../index";

import { CR_GIVEN_NAMES } from "../../src/data/givenNames-cr";
import { MX_GIVEN_NAMES } from "../../src/data/givenNames-mx";

const CONFIGS: Record<
  string,
  { name: string; dict: any; givenNames: Set<string>; dir: string }
> = {
  cr: {
    name: "Costa Rica",
    dict: Dictionaries.CR,
    givenNames: CR_GIVEN_NAMES,
    dir: path.join(__dirname, "../../src/data/test/cr"),
  },
  mx: {
    name: "México",
    dict: Dictionaries.MX,
    givenNames: MX_GIVEN_NAMES,
    dir: path.join(__dirname, "../../src/data/test/mx"),
  },
};

interface BenchmarkResult {
  name: string;
  totalRecords: number;
  totalTimeSeconds: number;
  recordsPerSecond: number;
  avgLatencyMs: number;
  successRate: number;
}

async function runBenchmarkForStrategy(
  config: { name: string; dict: any; givenNames: Set<string>; dir: string },
  strategyName: string,
  dictionaries: any[],
  fileSuffix: string,
  useSpecificNames: boolean,
): Promise<BenchmarkResult> {
  console.log(`\nINICIANDO TEST: ${strategyName}`);

  const setupStart = performance.now();

  const parser = new LatamNameParser({
    dictionaries,
    givenNames: useSpecificNames ? config.givenNames : undefined,
  });

  const setupTime = performance.now() - setupStart;
  console.log(`Carga del Parser: ${setupTime.toFixed(2)} ms`);

  if (!fs.existsSync(config.dir)) {
    throw new Error(`No se encontró el directorio de tests: ${config.dir}`);
  }

  const files = fs
    .readdirSync(config.dir)
    .filter((f) => f.startsWith("test_part_") && f.endsWith(".json"))
    .sort((a, b) => {
      const nA = parseInt(a.match(/\d+/)?.[0] || "0");
      const nB = parseInt(b.match(/\d+/)?.[0] || "0");
      return nA - nB;
    });

  if (files.length === 0)
    throw new Error(`No hay archivos 'test_part_*.json' para procesar.`);

  console.log(`Se encontraron ${files.length} fragmentos de prueba.`);

  let globalCount = 0;
  let correctCount = 0;
  const processStart = performance.now();

  for (const file of files) {
    const inputPath = path.join(config.dir, file);
    const partId = file.match(/test_part_(\d+)/)?.[1] || "unknown";
    const outputFilename = `results_part_${partId}${fileSuffix}.json`;
    const outputPath = path.join(config.dir, outputFilename);

    const inputStream = fs.createReadStream(inputPath, { encoding: "utf-8" });
    const outputStream = fs.createWriteStream(outputPath, {
      encoding: "utf-8",
    });
    const rl = readline.createInterface({
      input: inputStream,
      crlfDelay: Infinity,
    });

    outputStream.write("[\n");
    let isFirst = true;

    for await (let line of rl) {
      line = line.trim();
      if (!line || line === "[" || line === "]") continue;
      if (line.startsWith(",")) line = line.substring(1);
      if (line.endsWith(",")) line = line.substring(0, line.length - 1);

      try {
        const original = JSON.parse(line);
        const result = parser.parse(original.nombreCompleto);

        const isCorrect =
          original.nombre.toUpperCase() === result.givenName &&
          original.apellido1.toUpperCase() === result.surname1 &&
          original.apellido2.toUpperCase() === result.surname2;

        if (isCorrect) correctCount++;

        const outputRecord = {
          id: original.id || original.cedula,
          nombreCompleto: original.nombreCompleto,
          esperado: {
            n: original.nombre,
            ap1: original.apellido1,
            ap2: original.apellido2,
          },
          obtenido: {
            n: result.givenName,
            ap1: result.surname1,
            ap2: result.surname2,
          },
          esCorrecto: isCorrect,
        };

        const comma = isFirst ? "" : ",\n";
        outputStream.write(comma + JSON.stringify(outputRecord));
        isFirst = false;
        globalCount++;

        if (globalCount % 250000 === 0) {
          const pct = ((correctCount / globalCount) * 100).toFixed(2);
          process.stdout.write(
            `   ↳ Procesados: ${globalCount.toLocaleString()}... (${pct}% OK)\r`,
          );
        }
      } catch (e) {}
    }
    outputStream.write("\n]");
    outputStream.end();
  }

  const processEnd = performance.now();
  const totalTimeSec = (processEnd - processStart) / 1000;

  return {
    name: strategyName,
    totalRecords: globalCount,
    totalTimeSeconds: totalTimeSec,
    recordsPerSecond: globalCount / totalTimeSec,
    avgLatencyMs: (processEnd - processStart) / globalCount,
    successRate: (correctCount / globalCount) * 100,
  };
}

async function main() {
  const countryArg = process.argv[2]?.toLowerCase() || "cr";
  const config = CONFIGS[countryArg];

  if (!config) {
    console.error(`País no soportado: ${countryArg}`);
    return;
  }

  try {
    const resultsSpecific = await runBenchmarkForStrategy(
      config,
      `${config.name} (Optimized)`,
      [config.dict],
      `_${countryArg.toUpperCase()}`,
      true,
    );

    const resultsLATAM = await runBenchmarkForStrategy(
      config,
      "LATAM (Grande)",
      [Dictionaries.LATAM],
      "_LATAM",
      false,
    );

    console.log("\n\n========================================================");
    console.log(`RESULTADOS DE RENDIMIENTO: ${config.name.toUpperCase()}`);
    console.log("========================================================");

    console.table([
      {
        Estrategia: resultsSpecific.name,
        "Reg/Seg": Math.round(
          resultsSpecific.recordsPerSecond,
        ).toLocaleString(),
        "Precisión (%)": resultsSpecific.successRate.toFixed(4) + "%",
      },
      {
        Estrategia: resultsLATAM.name,
        "Reg/Seg": Math.round(resultsLATAM.recordsPerSecond).toLocaleString(),
        "Precisión (%)": resultsLATAM.successRate.toFixed(4) + "%",
      },
    ]);
  } catch (err) {
    console.error(err);
  }
}

main();
