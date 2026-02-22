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
const OFFENDERS_LIMIT = 50;

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

function getCsvFilename(countryCode: string): string {
  const baseName = `failures_${countryCode.toUpperCase()}`;
  let fileName = `${baseName}.csv`;
  let fullPath = path.join(DATA_ROOT, fileName);
  let counter = 0;
  while (fs.existsSync(fullPath)) {
    counter++;
    fileName = `${baseName}_${counter}.csv`;
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

  // 🔥 DETECTOR DE VILLANOS (Compuestos perdidos)
  const missingCompounds = new Map<string, number>();

  // 📉 PREPARAR CSV
  const csvPath = getCsvFilename(countryArg);
  const csvStream = fs.createWriteStream(csvPath, { encoding: "utf-8" });
  csvStream.write(
    "TIPO_ERROR,NOMBRE_COMPLETO,ESP_N,ESP_AP1,ESP_AP2,LOC_N,LOC_AP1,LOC_AP2\n",
  );

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

        let errorType = "";

        if (specOK && latOK) {
          stats.bothCorrect++;
        } else {
          // Clasificación del error para el CSV y Reporte
          if (!specOK && !latOK) {
            stats.bothWrong++;
            errorType = "AMBOS_FALLAN";
            if (samplesBothWrong.length < SAMPLE_LIMIT) {
              samplesBothWrong.push(
                formatComparison(recSpec, recLat, "💀 AMBOS FALLAN"),
              );
            }
          } else if (!specOK && latOK) {
            stats.onlySpecificWrong++;
            errorType = "LOCAL_FALLA";
            if (samplesOnlySpecificWrong.length < SAMPLE_LIMIT) {
              samplesOnlySpecificWrong.push(
                formatComparison(recSpec, recLat, "⚠️ LOCAL FALLA"),
              );
            }
          } else if (specOK && !latOK) {
            stats.onlyLatamWrong++;
            errorType = "LATAM_FALLA";
            if (samplesOnlyLatamWrong.length < SAMPLE_LIMIT) {
              samplesOnlyLatamWrong.push(
                formatComparison(recSpec, recLat, "✅ LOCAL GANA"),
              );
            }
          }

          // 🔥 ANÁLISIS FORENSE: ¿Por qué falló el local?
          // Buscamos apellidos compuestos que debieron ser detectados pero no lo fueron.
          if (!specOK) {
            const espAp1 = recSpec.esperado.ap1.trim();
            const espAp2 = recSpec.esperado.ap2.trim();

            // Si el apellido esperado tiene espacios (es compuesto), y fallamos, es un candidato a Whitelist.
            if (espAp1.includes(" ")) {
              missingCompounds.set(
                espAp1,
                (missingCompounds.get(espAp1) || 0) + 1,
              );
            }
            if (espAp2.includes(" ")) {
              missingCompounds.set(
                espAp2,
                (missingCompounds.get(espAp2) || 0) + 1,
              );
            }

            // Escribir en CSV
            csvStream.write(
              `${errorType},"${recSpec.nombreCompleto}","${recSpec.esperado.n}","${recSpec.esperado.ap1}","${recSpec.esperado.ap2}","${recSpec.obtenido.n}","${recSpec.obtenido.ap1}","${recSpec.obtenido.ap2}"\n`,
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

  csvStream.end();

  // Generar ranking de villanos
  const topOffenders = Array.from(missingCompounds.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, OFFENDERS_LIMIT)
    .map(
      ([name, count], idx) =>
        `${idx + 1}. [${name}] - Causa ${count.toLocaleString()} errores`,
    );

  const finalReportPath = getReportFilename(countryArg);

  const report = `
================================================================
📊 REPORTE DE CALIDAD: ${config.name.toUpperCase()}
================================================================
Fecha: ${new Date().toLocaleString()}
Total Registros: ${stats.total.toLocaleString()}

🏆 SCOREBOARD GENERAL:
- ${config.name} (Optimized):  ${((stats.specificCorrect / stats.total) * 100).toFixed(4)}%  (✅ ${stats.specificCorrect.toLocaleString()})
- LATAM (General):       ${((stats.latamCorrect / stats.total) * 100).toFixed(4)}%  (✅ ${stats.latamCorrect.toLocaleString()})

⚖️ BALANZA DE PODER:
- Ambos Correctos:      ${stats.bothCorrect.toLocaleString()}
- Ambos Incorrectos:    ${stats.bothWrong.toLocaleString()} (Morgue Común)
- Local Gana (Latam Falla): ${stats.onlyLatamWrong.toLocaleString()} (Ruido Latam evitado)
- LATAM Gana (Local Falla): ${stats.onlySpecificWrong.toLocaleString()} (Oportunidad de mejora Local)

================================================================
1. 🕵️‍♂️ LOS MÁS BUSCADOS (Top Offenders)
   (Apellidos compuestos que rompieron al parser local)
   Agregar estos a la Whitelist arreglará miles de casos.
================================================================
${topOffenders.length > 0 ? topOffenders.join("\n") : "¡No se detectaron patrones claros de compuestos faltantes!"}

================================================================
2. 💀 LA MORGUE COMÚN (Donde NINGUNO pudo)
   Total: ${stats.bothWrong.toLocaleString()}
================================================================
${samplesBothWrong.join("\n-----------------------------------------\n")}

================================================================
3. ⚠️ ERRORES EXCLUSIVOS DE ${config.name.toUpperCase()} (Oportunidades de Mejora)
   (Casos donde el diccionario LATAM sí funcionó)
   Total: ${stats.onlySpecificWrong.toLocaleString()}
================================================================
${samplesOnlySpecificWrong.join("\n-----------------------------------------\n")}

================================================================
4. ✅ ERRORES EXCLUSIVOS DE LATAM (Ruido Agregado)
   (Casos donde Local estaba bien, pero LATAM lo rompió)
   Total: ${stats.onlyLatamWrong.toLocaleString()}
================================================================
${samplesOnlyLatamWrong.join("\n-----------------------------------------\n")}
`;

  fs.writeFileSync(finalReportPath, report);
  console.log(`\n\n✅ ANÁLISIS COMPLETO.`);
  console.log(`📄 Reporte texto: ${finalReportPath}`);
  console.log(`📊 Reporte CSV:   ${csvPath}`);
}

analyze();
