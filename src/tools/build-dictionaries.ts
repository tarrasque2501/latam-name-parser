import fs from "fs";
import path from "path";
import readline from "readline";

const DATA_ROOT = path.join(__dirname, "../../src/data");
const MIN_NAME_FREQUENCY = 500; // Ajusta esto si quieres más o menos nombres

interface CountryConfig {
  inputDir: string;
  outputSurnamesFile: string;
  outputGivenNamesFile: string;
  variableName: string;
  filePattern: RegExp;
  encoding: BufferEncoding;
  skipHeader: boolean;
  // Modificado: Ahora acepta string[] para manejar múltiples archivos si es necesario
  files?: string[];
  parseLine: (
    line: string,
    fileName?: string,
  ) => {
    name?: string;
    ap1?: string;
    ap2?: string;
    surname?: string;
    count?: number;
  } | null;
}

// Función para reparar codificación (UTF-8 mal interpretado como Latin1/Windows-1252)
function fixEncoding(str: string): string {
  try {
    // Truco común: convertir a binario latin1 y leer como utf-8
    return Buffer.from(str, "binary").toString("utf-8");
  } catch (e) {
    return str;
  }
}

const STRATEGIES: Record<string, CountryConfig> = {
  cr: {
    inputDir: path.join(DATA_ROOT, "cr"),
    outputSurnamesFile: path.join(DATA_ROOT, "surnames-cr.json"),
    outputGivenNamesFile: path.join(DATA_ROOT, "givenNames-cr.ts"),
    variableName: "CR_GIVEN_NAMES",
    filePattern: /\.txt$/,
    encoding: "latin1",
    skipHeader: false,
    parseLine: (line) => {
      const parts = line.split(",");
      if (parts.length < 8) return null;
      return {
        name: parts[5]?.trim() || "",
        ap1: parts[6]?.trim() || "",
        ap2: parts[7]?.trim() || "",
      };
    },
  },
  mx: {
    inputDir: path.join(DATA_ROOT, "mx"),
    outputSurnamesFile: path.join(DATA_ROOT, "surnames-mx.json"),
    outputGivenNamesFile: path.join(DATA_ROOT, "givenNames-mx.ts"),
    variableName: "MX_GIVEN_NAMES",
    filePattern: /\.csv$/,
    encoding: "utf-8",
    skipHeader: true,
    parseLine: (line) => {
      const parts = line.split(",");
      // Asumiendo formato: NOMBRE,PRIMER APELLIDO,SEGUNDO APELLIDO
      if (parts.length < 3) return null;
      return {
        name: parts[0]?.trim() || "",
        ap1: parts[1]?.trim() || "",
        ap2: parts[2]?.trim() || "",
      };
    },
  },
  // 🔥 NUEVA ESTRATEGIA PARA ARGENTINA (AR)
  ar: {
    inputDir: path.join(DATA_ROOT, "ar"),
    outputSurnamesFile: path.join(DATA_ROOT, "surnames-ar.json"),
    outputGivenNamesFile: path.join(DATA_ROOT, "givenNames-ar.ts"),
    variableName: "AR_GIVEN_NAMES",
    filePattern: /\.csv$/,
    encoding: "latin1", // CSVs viejos suelen venir en latin1, pero usaremos fixEncoding
    skipHeader: true,
    // Definimos explícitamente los archivos porque tienen estructuras diferentes
    files: [
      "historico-nombres.csv",
      "apellidos_cantidad_personas_provincia.csv",
    ],
    parseLine: (line, fileName) => {
      const parts = line.split(",");

      // 1. Procesamiento de NOMBRES (historico-nombres.csv)
      // Columnas esperadas: nombre, cantidad, anio
      if (fileName?.includes("historico-nombres")) {
        if (parts.length < 2) return null;
        let rawName = parts[0]?.trim().replace(/"/g, "") || "";

        // Arreglar codificación rota (ej: HaydÃ© -> Haydé)
        if (rawName.includes("Ã")) {
          rawName = fixEncoding(rawName);
        }

        const count = parseInt(parts[1] || "0", 10);
        return { name: rawName, count: isNaN(count) ? 1 : count };
      }

      // 2. Procesamiento de APELLIDOS (apellidos_cantidad...)
      // Columnas esperadas: apellido, cantidad, ...
      if (fileName?.includes("apellidos_cantidad")) {
        if (parts.length < 2) return null;
        let surname = parts[0]?.trim().replace(/"/g, "") || "";

        // Arreglar codificación
        if (surname.includes("Ã")) {
          surname = fixEncoding(surname);
        }

        const count = parseInt(parts[1] || "0", 10);

        // Solo nos interesan apellidos compuestos para el JSON
        if (surname.includes(" ")) {
          return { surname: surname, count: isNaN(count) ? 1 : count };
        }
      }

      return null;
    },
  },
};

async function buildDictionaries(countryCode: string) {
  const config = STRATEGIES[countryCode];
  if (!config) {
    console.error(`Estrategia no encontrada para: ${countryCode}`);
    return;
  }

  console.log(`Iniciando construcción para ${countryCode.toUpperCase()}...`);

  // Mapas para conteo y unicidad
  const givenNameCounts = new Map<string, number>();
  const compoundSurnamesCounts = new Map<string, number>();

  // Determinar qué archivos procesar
  let filesToProcess: string[] = [];
  if (config.files) {
    filesToProcess = config.files.map((f) => path.join(config.inputDir, f));
  } else {
    // Si no hay lista explícita, buscar por patrón (lógica original)
    if (fs.existsSync(config.inputDir)) {
      filesToProcess = fs
        .readdirSync(config.inputDir)
        .filter((file) => config.filePattern.test(file))
        .map((file) => path.join(config.inputDir, file));
    }
  }

  let totalLines = 0;

  for (const filePath of filesToProcess) {
    if (!fs.existsSync(filePath)) {
      console.warn(`Archivo no encontrado, saltando: ${filePath}`);
      continue;
    }
    console.log(`Procesando: ${path.basename(filePath)}`);

    const fileStream = fs.createReadStream(filePath, {
      encoding: config.encoding,
    });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isHeader = config.skipHeader;

    for await (const line of rl) {
      if (isHeader) {
        isHeader = false;
        continue;
      }
      totalLines++;

      // Pasamos el nombre del archivo para saber qué lógica aplicar
      const data = config.parseLine(line, path.basename(filePath));
      if (!data) continue;

      // --- LÓGICA DE NOMBRES ---
      if (data.name) {
        // Normalización: Mayúsculas y separar compuestos
        const tokens = data.name
          .toUpperCase()
          .split(" ")
          .map((t) => t.trim())
          .filter(
            (t) =>
              t.length > 1 && // Ignorar iniciales sueltas
              ![
                "DE",
                "LA",
                "DEL",
                "LOS",
                "LAS",
                "SAN",
                "MARIA",
                "JOSE",
              ].includes(t),
          );

        const count = data.count || 1;

        tokens.forEach((token) => {
          // Excluir caracteres inválidos
          if (/^[A-ZÑÁÉÍÓÚÜ]+$/.test(token)) {
            givenNameCounts.set(
              token,
              (givenNameCounts.get(token) || 0) + count,
            );
          }
        });
      }

      // --- LÓGICA DE APELLIDOS (General y AR) ---
      const apellidos = [];
      if (data.ap1) apellidos.push(data.ap1);
      if (data.ap2) apellidos.push(data.ap2);
      if (data.surname) apellidos.push(data.surname); // Caso AR

      apellidos.forEach((ap) => {
        const cleanAp = ap.toUpperCase().trim();
        // Solo guardamos compuestos
        if (cleanAp.includes(" ")) {
          const count = data.count || 1;
          // Acumular frecuencia para ordenar después
          compoundSurnamesCounts.set(
            cleanAp,
            (compoundSurnamesCounts.get(cleanAp) || 0) + count,
          );
        }
      });
    }
  }

  console.log(`\nANÁLISIS FINALIZADO (${totalLines.toLocaleString()} líneas)`);

  // --- GENERACIÓN DE ARCHIVO DE NOMBRES ---
  // Filtramos por frecuencia para limpiar basura (errores de OCR, typos raros)
  const sortedNames = Array.from(givenNameCounts.entries())
    .filter(([_, count]) => count > MIN_NAME_FREQUENCY) // Umbral de ruido
    .sort((a, b) => b[1] - a[1]) // Más frecuentes primero
    .map(([name]) => name);

  const namesContent = `
// Diccionario generado automáticamente para ${countryCode.toUpperCase()}
// Total nombres procesados: ${sortedNames.length}
export const ${config.variableName} = new Set<string>([
  ${sortedNames.map((n) => `"${n}"`).join(",\n  ")}
]);
`;
  fs.writeFileSync(config.outputGivenNamesFile, namesContent);
  console.log(
    `Nombres actualizados en: ${config.outputGivenNamesFile} (${sortedNames.length} nombres únicos)`,
  );

  // --- GENERACIÓN DE ARCHIVO DE APELLIDOS (JSON) ---
  // Ordenar apellidos compuestos por frecuencia (los más comunes primero)
  const sortedSurnames = Array.from(compoundSurnamesCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Mayor cantidad primero
    .map(([surname]) => surname); // Solo el nombre

  fs.writeFileSync(
    config.outputSurnamesFile,
    JSON.stringify(sortedSurnames, null, 2),
  );
  console.log(
    `Apellidos compuestos actualizados en: ${config.outputSurnamesFile} (${sortedSurnames.length} apellidos)`,
  );
}

// Ejecutar para el argumento pasado (ej: "ts-node build-dictionaries.ts ar")
const targetCountry = process.argv[2];
if (targetCountry) {
  buildDictionaries(targetCountry).catch(console.error);
} else {
  console.log("Por favor especifica un código de país (ej: cr, mx, ar)");
}
