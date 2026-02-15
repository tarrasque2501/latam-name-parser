import fs from "fs";
import path from "path";
import readline from "readline";

const DATA_ROOT = path.join(__dirname, "../../src/data");

const CONFIGS: Record<string, { name: string; dir: string; suffix: string }> = {
  cr: {
    name: "Costa Rica",
    dir: path.join(DATA_ROOT, "test/cr"),
    suffix: "_CR.json",
  },
  mx: {
    name: "México",
    dir: path.join(DATA_ROOT, "test/mx"),
    suffix: "_MX.json",
  },
};

const SAMPLE_LIMIT = 50;

function getReportFilename(countryCode: string): string {
  const baseName = `final_report_${countryCode.toUpperCase()}`;
  let fileName = `${baseName}.txt`;
  let fullPath = path.join(DATA_ROOT, fileName);
  let counter = 0;

  while (fs.existsSync(fullPath)) {
    counter++;
    fileName = `${baseName}_${counter}.txt`;
    fullPath = path.join(DATA_ROOT, fileName);
  }
  return fullPath;
}

async function* zipFiles(pathA: string, pathB: string) {
  const streamA = fs.createReadStream(pathA, { encoding: "utf-8" });
  const streamB = fs.createReadStream(pathB, { encoding: "utf-8" });

  const rlA = readline.createInterface({ input: streamA, crlfDelay: Infinity });
  const rlB = readline.createInterface({ input: streamB, crlfDelay: Infinity });

  const iterA = rlA[Symbol.asyncIterator]();
  const iterB = rlB[Symbol.asyncIterator]();

  while (true) {
    const [resA, resB] = await Promise.all([iterA.next(), iterB.next()]);
    if (resA.done || resB.done) break;
    yield [resA.value, resB.value];
  }
}

function formatComparison(
  recSpecific: any,
  recLATAM: any,
  label: string,
): string {
  const fmt = (p: any) => `[${p.n}] [${p.ap1}] [${p.ap2}]`;

  return (
    `${label}: "${recSpecific.nombreCompleto}"\n` +
    `   Esperado:   ${fmt(recSpecific.esperado)}\n` +
    `   Local Dice: ${fmt(recSpecific.obtenido)} ${recSpecific.esCorrecto ? "✅" : "❌"}\n` +
    `   LATAM Dice: ${fmt(recLATAM.obtenido)} ${recLATAM.esCorrecto ? "✅" : "❌"}`
  );
}

async function analyze() {
  const countryArg = process.argv[2]?.toLowerCase() || "cr";
  const config = CONFIGS[countryArg];

  if (!config) {
    console.error(`País no soportado: ${countryArg}`);
    console.error(`   Opciones: ${Object.keys(CONFIGS).join(", ")}`);
    return;
  }

  console.log(`INICIANDO ANÁLISIS DETALLADO: ${config.name} vs LATAM`);
  console.log(`Directorio: ${config.dir}`);

  if (!fs.existsSync(config.dir)) {
    console.error(`No existe el directorio: ${config.dir}`);
    return;
  }

  const filesSpecific = fs
    .readdirSync(config.dir)
    .filter((f) => f.endsWith(config.suffix))
    .sort((a, b) => {
      const nA = parseInt(a.match(/\d+/)?.[0] || "0");
      const nB = parseInt(b.match(/\d+/)?.[0] || "0");
      return nA - nB;
    });

  if (filesSpecific.length === 0) {
    console.error(
      `No se encontraron archivos de resultados (*${config.suffix}).`,
    );
    return;
  }

  console.log(`Analizando ${filesSpecific.length} pares de archivos...`);

  let stats = {
    total: 0,
    specificCorrect: 0,
    latamCorrect: 0,
    bothCorrect: 0,
    bothWrong: 0,
    onlySpecificWrong: 0,
    onlyLatamWrong: 0,
  };

  const samplesBothWrong: string[] = [];
  const samplesOnlySpecificWrong: string[] = [];
  const samplesOnlyLatamWrong: string[] = [];

  for (const fileSpecific of filesSpecific) {
    const fileLATAM = fileSpecific.replace(config.suffix, "_LATAM.json");
    const pathSpecific = path.join(config.dir, fileSpecific);
    const pathLATAM = path.join(config.dir, fileLATAM);

    if (!fs.existsSync(pathLATAM)) {
      console.warn(`Saltando ${fileSpecific}: No tiene par LATAM.`);
      continue;
    }

    for await (const [lineA, lineB] of zipFiles(pathSpecific, pathLATAM)) {
      const strA = lineA.trim().replace(/^\[|\]$|^,|,$/g, "");
      const strB = lineB.trim().replace(/^\[|\]$|^,|,$/g, "");

      if (!strA || !strB) continue;

      try {
        const recSpec = JSON.parse(strA);
        const recLat = JSON.parse(strB);

        stats.total++;
        const specOK = recSpec.esCorrecto;
        const latOK = recLat.esCorrecto;

        if (specOK) stats.specificCorrect++;
        if (latOK) stats.latamCorrect++;

        if (specOK && latOK) {
          stats.bothCorrect++;
        } else if (!specOK && !latOK) {
          stats.bothWrong++;
          if (samplesBothWrong.length < SAMPLE_LIMIT) {
            samplesBothWrong.push(
              formatComparison(recSpec, recLat, "AMBOS FALLAN"),
            );
          }
        } else if (!specOK && latOK) {
          stats.onlySpecificWrong++;
          if (samplesOnlySpecificWrong.length < SAMPLE_LIMIT) {
            samplesOnlySpecificWrong.push(
              formatComparison(recSpec, recLat, "LOCAL FALLA"),
            );
          }
        } else if (specOK && !latOK) {
          stats.onlyLatamWrong++;
          if (samplesOnlyLatamWrong.length < SAMPLE_LIMIT) {
            samplesOnlyLatamWrong.push(
              formatComparison(recSpec, recLat, "LATAM FALLA"),
            );
          }
        }

        if (stats.total % 500000 === 0)
          process.stdout.write(
            `   ↳ Analizados: ${stats.total.toLocaleString()}...\r`,
          );
      } catch (e) {}
    }
  }

  const finalReportPath = getReportFilename(countryArg);

  const report = `
================================================================
REPORTE DE CALIDAD: ${config.name.toUpperCase()}
================================================================
Fecha: ${new Date().toLocaleString()}
Total Registros: ${stats.total.toLocaleString()}

SCOREBOARD GENERAL:
- ${config.name} (Optimized):  ${((stats.specificCorrect / stats.total) * 100).toFixed(4)}%  (${stats.specificCorrect.toLocaleString()})
- LATAM (General):       ${((stats.latamCorrect / stats.total) * 100).toFixed(4)}%  (${stats.latamCorrect.toLocaleString()})

BALANZA DE PODER:
- Ambos Correctos:      ${stats.bothCorrect.toLocaleString()}
- Ambos Incorrectos:    ${stats.bothWrong.toLocaleString()} (Morgue Común)
- Local Gana (Latam Falla): ${stats.onlyLatamWrong.toLocaleString()} (Ruido Latam evitado)
- LATAM Gana (Local Falla): ${stats.onlySpecificWrong.toLocaleString()} (Oportunidad de mejora Local)

================================================================
1. LA MORGUE COMÚN (Donde NINGUNO pudo)
   Total: ${stats.bothWrong.toLocaleString()}
================================================================
${samplesBothWrong.join("\n-----------------------------------------\n")}

================================================================
2. ERRORES EXCLUSIVOS DE ${config.name.toUpperCase()} (Oportunidades de Mejora)
   (Casos donde el diccionario LATAM sí funcionó)
   Total: ${stats.onlySpecificWrong.toLocaleString()}
================================================================
${samplesOnlySpecificWrong.join("\n-----------------------------------------\n")}

================================================================
3. ERRORES EXCLUSIVOS DE LATAM (Ruido Agregado)
   (Casos donde Local estaba bien, pero LATAM lo rompió)
   Total: ${stats.onlyLatamWrong.toLocaleString()}
================================================================
${samplesOnlyLatamWrong.join("\n-----------------------------------------\n")}
`;

  fs.writeFileSync(finalReportPath, report);
  console.log(`\n\nANÁLISIS COMPLETO.`);
  console.log(`Reporte guardado en: ${finalReportPath}`);
}

analyze();
