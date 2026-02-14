import fs from "fs";
import path from "path";
import readline from "readline";
import { performance } from "perf_hooks";
import { LatamNameParser, Dictionaries } from "../../src/index";

const TEST_DIR = path.join(__dirname, "../../src/data/test/cr");

interface BenchmarkResult {
  name: string;
  totalRecords: number;
  totalTimeSeconds: number;
  recordsPerSecond: number;
  avgLatencyMs: number;
}

async function runBenchmarkForStrategy(
  strategyName: string,
  dictionaries: any[],
  fileSuffix: string,
): Promise<BenchmarkResult> {
  console.log(`\nINICIANDO TEST: ${strategyName}`);

  const setupStart = performance.now();
  const parser = new LatamNameParser({ dictionaries });
  const setupTime = performance.now() - setupStart;
  console.log(`Carga del Parser: ${setupTime.toFixed(2)} ms`);

  if (!fs.existsSync(TEST_DIR)) {
    throw new Error(`No se encontró el directorio de tests: ${TEST_DIR}`);
  }

  const files = fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.startsWith("test_part_") && f.endsWith(".json"))
    .sort((a, b) => {
      const nA = parseInt(a.match(/\d+/)?.[0] || "0");
      const nB = parseInt(b.match(/\d+/)?.[0] || "0");
      return nA - nB;
    });

  if (files.length === 0)
    throw new Error("No hay archivos 'test_part_*.json' para procesar.");

  console.log(`Se encontraron ${files.length} fragmentos de prueba.`);
  let globalCount = 0;
  const processStart = performance.now();

  for (const file of files) {
    const inputPath = path.join(TEST_DIR, file);
    const partId = file.match(/test_part_(\d+)/)?.[1] || "unknown";
    const outputFilename = `results_part_${partId}${fileSuffix}.json`;
    const outputPath = path.join(TEST_DIR, outputFilename);
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

        const outputRecord = {
          id: original.cedula,
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
          esCorrecto:
            original.nombre === result.givenName &&
            original.apellido1 === result.surname1 &&
            original.apellido2 === result.surname2,
        };

        const comma = isFirst ? "" : ",\n";
        outputStream.write(comma + JSON.stringify(outputRecord));
        isFirst = false;
        globalCount++;

        if (globalCount % 250000 === 0) {
          process.stdout.write(
            `Total Procesados: ${globalCount.toLocaleString()}...\r`,
          );
        }
      } catch (e) {}
    }
    outputStream.write("\n]");
    outputStream.end();
  }
  const processEnd = performance.now();
  const totalTimeMs = processEnd - processStart;
  const totalTimeSec = totalTimeMs / 1000;
  console.log(
    `\n Finalizado. Total: ${globalCount.toLocaleString()} registros procesados.`,
  );
  return {
    name: strategyName,
    totalRecords: globalCount,
    totalTimeSeconds: totalTimeSec,
    recordsPerSecond: globalCount / totalTimeSec,
    avgLatencyMs: totalTimeMs / globalCount,
  };
}

async function main() {
  try {
    const resultsCR = await runBenchmarkForStrategy(
      "CR (Solo)",
      [Dictionaries.CR],
      "_CR",
    );

    const resultsLATAM = await runBenchmarkForStrategy(
      "LATAM (Grande)",
      [Dictionaries.LATAM],
      "_LATAM",
    );

    console.log("\n\n========================================================");
    console.log("RESULTADOS DE RENDIMIENTO (BENCHMARK)");
    console.log("========================================================");

    console.table([
      {
        Estrategia: resultsCR.name,
        "Tiempo Total (s)": resultsCR.totalTimeSeconds.toFixed(3),
        "Registros/Seg": Math.round(
          resultsCR.recordsPerSecond,
        ).toLocaleString(),
        "Latencia (ms)": resultsCR.avgLatencyMs.toFixed(5),
      },
      {
        Estrategia: resultsLATAM.name,
        "Tiempo Total (s)": resultsLATAM.totalTimeSeconds.toFixed(3),
        "Registros/Seg": Math.round(
          resultsLATAM.recordsPerSecond,
        ).toLocaleString(),
        "Latencia (ms)": resultsLATAM.avgLatencyMs.toFixed(5),
      },
    ]);

    const speedDiff =
      resultsLATAM.recordsPerSecond - resultsCR.recordsPerSecond;
    const percentDiff = (speedDiff / resultsCR.recordsPerSecond) * 100;

    console.log("--------------------------------------------------------");
    console.log(
      `Impacto de Rendimiento usando LATAM: ${percentDiff.toFixed(2)}% de velocidad`,
    );
    console.log("========================================================\n");
  } catch (err) {
    console.error(err);
  }
}

main();
