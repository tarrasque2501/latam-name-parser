import fs from "fs";
import path from "path";
import readline from "readline";

const TEST_DIR = path.join(__dirname, "../../src/data/test/cr");
const REPORT_BASE_NAME = "final_report";
const DATA_DIR = path.join(__dirname, "../../src/data");

const SAMPLE_LIMIT = 50;

function getNextReportFileName(): string {
  let counter = 0;
  let fileName = `${REPORT_BASE_NAME}.txt`;
  let fullPath = path.join(DATA_DIR, fileName);

  while (fs.existsSync(fullPath)) {
    counter++;
    fileName = `${REPORT_BASE_NAME}_${counter}.txt`;
    fullPath = path.join(DATA_DIR, fileName);
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

function formatComparison(recCR: any, recLATAM: any, label: string): string {
  const fmt = (p: any) => `[${p.n}] [${p.ap1}] [${p.ap2}]`;

  return (
    `${label}: "${recCR.nombreCompleto}"\n` +
    `   Esperado:   ${fmt(recCR.esperado)}\n` +
    `   CR Dice:    ${fmt(recCR.obtenido)} ${recCR.esCorrecto ? "✅" : "❌"}\n` +
    `   LATAM Dice: ${fmt(recLATAM.obtenido)} ${recLATAM.esCorrecto ? "✅" : "❌"}`
  );
}

async function analyze() {
  console.log("INICIANDO ANÁLISIS DETALLADO (CR vs LATAM)...");

  if (!fs.existsSync(TEST_DIR)) {
    console.error(`No existe el directorio: ${TEST_DIR}`);
    return;
  }

  const filesCR = fs
    .readdirSync(TEST_DIR)
    .filter((f) => f.match(/^results_part_\d+_CR\.json$/))
    .sort((a, b) => {
      const nA = parseInt(a.match(/\d+/)?.[0] || "0");
      const nB = parseInt(b.match(/\d+/)?.[0] || "0");
      return nA - nB;
    });

  if (filesCR.length === 0) {
    console.error("No se encontraron archivos de resultados.");
    return;
  }

  console.log(`Analizando ${filesCR.length} fragmentos...`);

  let stats = {
    total: 0,
    crCorrect: 0,
    latamCorrect: 0,
    bothCorrect: 0,
    bothWrong: 0,
    onlyCrWrong: 0,
    onlyLatamWrong: 0,
  };

  const samplesBothWrong: string[] = [];
  const samplesOnlyCrWrong: string[] = [];
  const samplesOnlyLatamWrong: string[] = [];

  for (const fileCR of filesCR) {
    const fileLATAM = fileCR.replace("_CR.json", "_LATAM.json");
    const pathCR = path.join(TEST_DIR, fileCR);
    const pathLATAM = path.join(TEST_DIR, fileLATAM);

    if (!fs.existsSync(pathLATAM)) continue;

    for await (const [lineA, lineB] of zipFiles(pathCR, pathLATAM)) {
      const strA = lineA.trim().replace(/^\[|\]$|^,|,$/g, "");
      const strB = lineB.trim().replace(/^\[|\]$|^,|,$/g, "");

      if (!strA || !strB) continue;

      try {
        const recCR = JSON.parse(strA);
        const recLATAM = JSON.parse(strB);

        stats.total++;
        const crOK = recCR.esCorrecto;
        const latamOK = recLATAM.esCorrecto;

        if (crOK) stats.crCorrect++;
        if (latamOK) stats.latamCorrect++;

        if (crOK && latamOK) {
          stats.bothCorrect++;
        } else if (!crOK && !latamOK) {
          stats.bothWrong++;
          if (samplesBothWrong.length < SAMPLE_LIMIT) {
            samplesBothWrong.push(
              formatComparison(recCR, recLATAM, "💀 AMBOS FALLAN"),
            );
          }
        } else if (!crOK && latamOK) {
          stats.onlyCrWrong++;
          if (samplesOnlyCrWrong.length < SAMPLE_LIMIT) {
            samplesOnlyCrWrong.push(
              formatComparison(recCR, recLATAM, "❌ CR FALLA"),
            );
          }
        } else if (crOK && !latamOK) {
          stats.onlyLatamWrong++;
          if (samplesOnlyLatamWrong.length < SAMPLE_LIMIT) {
            samplesOnlyLatamWrong.push(
              formatComparison(recCR, recLATAM, "⚠️ LATAM FALLA"),
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

  const finalReportPath = getNextReportFileName();

  const report = `
================================================================
📊 REPORTE DE CALIDAD DETALLADO
================================================================
Fecha: ${new Date().toLocaleString()}
Total Registros: ${stats.total.toLocaleString()}

🏆 SCOREBOARD GENERAL:
- CR (Small):    ${((stats.crCorrect / stats.total) * 100).toFixed(4)}%  (✅ ${stats.crCorrect.toLocaleString()})
- LATAM (Big):   ${((stats.latamCorrect / stats.total) * 100).toFixed(4)}%  (✅ ${stats.latamCorrect.toLocaleString()})

⚖️ BALANZA DE PODER:
- Ambos Correctos:      ${stats.bothCorrect.toLocaleString()}
- Ambos Incorrectos:    ${stats.bothWrong.toLocaleString()} (Morgue Común)
- CR Gana (Latam Falla): ${stats.onlyLatamWrong.toLocaleString()} (Ruido Latam)
- LATAM Gana (CR Falla): ${stats.onlyCrWrong.toLocaleString()} (Oportunidad CR)

================================================================
1. 💀 LA MORGUE COMÚN (Donde NINGUNO pudo)
   Total: ${stats.bothWrong.toLocaleString()}
================================================================
${samplesBothWrong.join("\n-----------------------------------------\n")}

================================================================
2. ❌ ERRORES EXCLUSIVOS DE CR (Oportunidades de Mejora)
   (Casos donde el diccionario LATAM sí funcionó)
   Total: ${stats.onlyCrWrong.toLocaleString()}
================================================================
${samplesOnlyCrWrong.join("\n-----------------------------------------\n")}

================================================================
3. ⚠️ ERRORES EXCLUSIVOS DE LATAM (Ruido Agregado)
   (Casos donde CR estaba bien, pero LATAM lo rompió)
   Total: ${stats.onlyLatamWrong.toLocaleString()}
================================================================
${samplesOnlyLatamWrong.join("\n-----------------------------------------\n")}
`;

  fs.writeFileSync(finalReportPath, report);
  console.log(`\n\n✅ ANÁLISIS COMPLETO.`);
  console.log(`📄 Reporte guardado en: ${finalReportPath}`);
}

analyze();
