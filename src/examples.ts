import {
  LatamNameParser,
  ParseOptions,
  Dictionaries,
  MX_STRATEGY,
} from "./index";

const parser = new LatamNameParser({
  dictionaries: [Dictionaries.MX],
  strategy: MX_STRATEGY,
});

function runTest(name: string, options: ParseOptions, description: string) {
  console.log(`\n   TEST: ${description}`);
  console.log(`   Original Input : "${name}"`);
  console.log(`   Options        : ${JSON.stringify(options)}`);

  const result = parser.parse(name, options);

  console.log(`   [ PARSED RESULT ]`);
  console.log(`     - Given Name : [${result.givenName}]`);
  console.log(`     - Surname 1  : [${result.surname1}]`);
  console.log(`     - Surname 2  : [${result.surname2}]`);

  if (options.format !== "surname-first") {
    console.log(`   [ OUTPUT FORMATS ]`);
    console.log(`     - Natural     : ${LatamNameParser.toNatural(result)}`);
    console.log(`     - Standard    : ${LatamNameParser.toStandard(result)}`);
    console.log(`     - Full-Hyphen : ${LatamNameParser.toFullHyphen(result)}`);
  }
}

console.log("\n========================================");
console.log("       STARTING LATAM PARSER TESTS");
console.log("========================================");

runTest("JUAN PEREZ GARCIA", {}, "Simple Natural Name (Default 2 Surnames)");

runTest(
  "MARIA DE LOS ANGELES DE LA CRUZ DEL VALLE",
  {},
  "Compound Given Name and Surnames",
);

runTest(
  "DE LA CRUZ DEL VALLE MARIA DE LOS ANGELES",
  { format: "surname-first" },
  "Inverted Format (Left to Right)",
);

runTest(
  "JUAN CARLOS MARTIN DEL CAMPO",
  { expectedSurnames: 1 },
  "Single Surname Natural (Expects S1 only)",
);

runTest(
  "MARTIN DEL CAMPO JUAN CARLOS",
  { format: "surname-first", expectedSurnames: 1 },
  "Single Surname Inverted (Left to Right, 1 Surname)",
);

console.log("\n========================================");
console.log("       TESTS COMPLETED");
console.log("========================================\n");
