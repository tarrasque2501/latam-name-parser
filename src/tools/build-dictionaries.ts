import fs from "fs";
import path from "path";
import readline from "readline";

const DATA_ROOT = path.join(__dirname, "../../src/data");
const MIN_NAME_FREQUENCY = 500;

interface CountryConfig {
  inputDir: string;
  outputSurnamesFile: string;
  outputGivenNamesFile: string;
  variableName: string;
  filePattern: RegExp;
  encoding: BufferEncoding;
  skipHeader: boolean;
  parseLine: (
    line: string,
  ) => { name: string; ap1: string; ap2: string } | null;
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
    filePattern: /\.csv$/i,
    encoding: "latin1",
    skipHeader: true,
    parseLine: (line) => {
      const parts = line.split(",");
      if (parts.length < 6) return null;
      return {
        ap1: parts[3]?.trim().replace(/"/g, "") || "",
        ap2: parts[4]?.trim().replace(/"/g, "") || "",
        name: parts[5]?.trim().replace(/"/g, "") || "",
      };
    },
  },
};

async function buildDictionaries() {
  const countryCode = process.argv[2]?.toLowerCase();
  const config = STRATEGIES[countryCode];

  if (!config) {
    console.error("Error: Debes especificar el país.");
    console.error(
      "   Uso: npx ts-node src/tools/build-dictionaries.ts <cr|mx>",
    );
    return;
  }

  console.log(
    `INICIANDO CONSTRUCCIÓN DE DICCIONARIOS: [${countryCode.toUpperCase()}]`,
  );

  if (!fs.existsSync(config.inputDir)) {
    console.error(`Directorio no encontrado: ${config.inputDir}`);
    return;
  }

  const files = fs
    .readdirSync(config.inputDir)
    .filter((f) => config.filePattern.test(f));
  console.log(`Encontrados ${files.length} archivos para entrenar.`);

  const givenNameCounts = new Map<string, number>();
  const compoundSurnames = new Set<string>();

  if (fs.existsSync(config.outputSurnamesFile)) {
    try {
      const oldData = JSON.parse(
        fs.readFileSync(config.outputSurnamesFile, "utf-8"),
      );
      oldData.forEach((s: string) =>
        compoundSurnames.add(s.toUpperCase().trim()),
      );
    } catch (e) {}
  }

  let totalLines = 0;

  for (const file of files) {
    const filePath = path.join(config.inputDir, file);
    console.log(`Leyendo: ${file}...`);
    const fileStream = fs.createReadStream(filePath, {
      encoding: config.encoding,
    });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;

    for await (const line of rl) {
      if (config.skipHeader && isFirstLine) {
        isFirstLine = false;
        continue;
      }
      if (!line || line.length < 5) continue;

      const data = config.parseLine(line);
      if (!data || !data.name || /^\d+$/.test(data.name)) continue;

      totalLines++;
      const tokens = data.name.toUpperCase().split(/\s+/);
      tokens.forEach((token: string) => {
        if (
          token.length > 2 &&
          !["DEL", "LOS", "LAS", "SAN", "MARIA", "JOSE"].includes(token)
        ) {
          givenNameCounts.set(token, (givenNameCounts.get(token) || 0) + 1);
        }
      });

      [data.ap1, data.ap2].forEach((ap) => {
        if (ap && ap.includes(" ")) {
          compoundSurnames.add(ap.toUpperCase().trim());
        }
      });
    }
  }

  console.log(`\nANÁLISIS FINALIZADO (${totalLines.toLocaleString()} líneas)`);

  const sortedNames = Array.from(givenNameCounts.entries())
    .filter(([_, count]) => count > MIN_NAME_FREQUENCY)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const namesContent = `
// Diccionario generado automáticamente para ${countryCode.toUpperCase()}
export const ${config.variableName} = new Set<string>([
  ${sortedNames.map((n) => `"${n}"`).join(",\n  ")}
]);
`;
  fs.writeFileSync(config.outputGivenNamesFile, namesContent);
  console.log(
    `Nombres actualizados en: ${config.outputGivenNamesFile} (${sortedNames.length} nombres)`,
  );

  const sortedSurnames = Array.from(compoundSurnames).sort((a, b) => {
    const wordsA = a.split(" ").length;
    const wordsB = b.split(" ").length;
    return wordsB !== wordsA ? wordsB - wordsA : b.length - a.length;
  });

  fs.writeFileSync(
    config.outputSurnamesFile,
    JSON.stringify(sortedSurnames, null, 2),
  );
  console.log(
    `Apellidos actualizados en: ${config.outputSurnamesFile} (${sortedSurnames.length} compuestos)`,
  );
}

buildDictionaries();
