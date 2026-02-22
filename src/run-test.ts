import { LatamNameParser } from "./LatamNameParser";
import { CountryStrategy, ParseOptions } from "./types";

// Import your real CR data
import crSurnames from "../src/data/surnames-cr.json";
import { CR_GIVEN_NAMES } from "../src/data/givenNames-cr";

// 1. Create a test strategy using your data
const testStrategy: CountryStrategy = {
  commonSurnames: new Set(["PEREZ", "GARCIA", "RUIZ", "VALLE", "CRUZ"]),
  givenNamesBlacklist: new Set(),
  compoundWhitelist: new Set(["MARTIN DEL CAMPO"]),
  ambiguousSurnames: new Set(),
  givenNames: CR_GIVEN_NAMES,
};

// 2. Instantiate the Parser
const parser = new LatamNameParser({
  dictionaries: [crSurnames],
  strategy: testStrategy,
});

// ============================================================
// TESTING LOGIC
// ============================================================

function runTest(name: string, options: ParseOptions, description: string) {
  console.log(`\n   TEST: ${description}`);
  console.log(`   Original Input : "${name}"`);
  console.log(`   Options        : ${JSON.stringify(options)}`);

  const result = parser.parse(name, options);

  console.log(`   [ PARSED RESULT ]`);
  console.log(`     - Given Name : [${result.givenName}]`);
  console.log(`     - Surname 1  : [${result.surname1}]`);
  console.log(`     - Surname 2  : [${result.surname2}]`);

  // If not inverted, test the static formatters as well
  if (options.format !== "surname-first") {
    console.log(`   [ OUTPUT FORMATS ]`);
    console.log(`     - Natural     : ${LatamNameParser.toNatural(result)}`);
    console.log(`     - Standard    : ${LatamNameParser.toStandard(result)}`);
    console.log(`     - Full-Hyphen : ${LatamNameParser.toFullHyphen(result)}`);
  }
}

// 3. Execute the test scenarios!
console.log("\n========================================");
console.log("       STARTING LATAM PARSER TESTS");
console.log("========================================");

// 1. Simple Name (Natural)
runTest("JUAN PEREZ GARCIA", {}, "Simple Natural Name");

// 2. Complex Name (Compounds, Natural)
runTest(
  "MARIA DE LOS ANGELES DE LA CRUZ DEL VALLE",
  {},
  "Compound Given Name and Surnames",
);

// 3. Hyphenation Check (Standard/Full-Hyphen)
runTest(
  "JOSE LUIS MARTIN DEL CAMPO RUIZ",
  {},
  "Hyphen protection check in Compound Surname 1",
);

// 4. Inverted Format (Surname-First)
runTest(
  "DE LA CRUZ DEL VALLE MARIA DE LOS ANGELES",
  { format: "surname-first" },
  "Inverted Format (Left to Right)",
);

// 5. Simple Inverted Format
runTest(
  "PEREZ GARCIA JUAN",
  { format: "surname-first" },
  "Simple Inverted Format S1 S2 Given Name",
);

console.log("\n========================================");
console.log("       TESTS COMPLETED");
console.log("========================================\n");
