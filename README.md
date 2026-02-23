# Latam Name Parser

[![NPM Version](https://img.shields.io/npm/v/latam-name-parser?style=for-the-badge&color=blue)](https://www.npmjs.com/package/latam-name-parser)
[![Downloads](https://img.shields.io/npm/dt/latam-name-parser?style=for-the-badge&color=green)](https://www.npmjs.com/package/latam-name-parser)
[![License](https://img.shields.io/npm/l/latam-name-parser?style=for-the-badge&color=orange)](https://github.com/tarrasque2501/latam-name-parser/blob/main/LICENSE)

> **New in v1.3.0:** Massive performance and feature update!
>
> - Speed: Rebuilt with a Zero-Allocation C++ Regex bypass, achieving >160,000 records/second.
> - Multi-Country Support: Dedicated parsing strategies for Mexico, Argentina, Costa Rica, and any incoming countrys.
> - New Parsing Modes: Support for surname-first (inverted) formats and 1-surname models.

A specialized, high-performance parser designed for the complexity of **Latin American identities**. Unlike simple splitters, it uses a **"Reverse Subtraction"** strategy and regionally-mined dictionaries to correctly identify compound surnames (e.g., _De La O_, _Montes de Oca_) and dual surnames.

---

## Benchmarks & Validation

This library isn't just based on grammatical rules; it is **data-mined**. We validate our logic against massive, real-world government datasets to ensure production readiness.

| Country / Dataset   | Records Evaluated | Accuracy (LATAM) | Accuracy (Optimized) | Speed (Req/Sec)   |
| :------------------ | :---------------- | :--------------- | :------------------- | :---------------- |
| Argentina (RENAPER) | ~14.6 Million     | 99.9998%         | 97.74%               | 166,300 names/sec |
| Costa Rica (TSE)    | ~4.1 Million      | 99.6990%         | 99.9953%             | 160,469 names/sec |
| Mexico (INE)        | ~20.0 Million     | TBD              | TBD                  | TBD names/sec     |

---

## Installation

Install the package via your favorite package manager:

```
npm install latam-name-parser
```

---

## Usage

**Basic Implementation**
To use the parser, you must instantiate it by providing a Dictionary and a Country Strategy. This ensures the parser knows how to handle region-specific compound names and ambiguous cases.

### Option A: Full LATAM Coverage

Use the combined `LATAM` dictionary if your database contains people from all over Latin America.

```
import { LatamNameParser, Dictionaries, MX_STRATEGY } from "latam-name-parser";

// We use MX_STRATEGY as a robust default, but feed it the entire LATAM dictionary
const parser = new LatamNameParser({
  dictionaries: [Dictionaries.LATAM],
  strategy: MX_STRATEGY
});

const parsed = parser.parse("MARIA DEL CARMEN GUTIERREZ DE PIÑERES RENAULD");
```

```
Output:{
"fullName": "MARIA DEL CARMEN GUTIERREZ DE PIÑERES RENAULD",
"givenName": "MARIA DEL CARMEN",
"surname1": "GUTIERREZ DE PIÑERES",
"surname2": "RENAULD",
"isCompound": true
}
```

### Option B: Single Country (Maximum Performance)

If you know your data comes from a specific country, load only that dictionary. This uses less RAM and makes the parser even faster.

```
import { LatamNameParser, Dictionaries, CR_STRATEGY } from "latam-name-parser";

const parserCr = new LatamNameParser({
  dictionaries: [Dictionaries.CR], // Only loads Costa Rican surnames
  strategy: CR_STRATEGY
});
```

### Option C: Custom Combinations

Because dictionaries is an array, you can mix and match to support specific regions without loading the entire LATAM database.

```
import { LatamNameParser, Dictionaries, AR_STRATEGY } from "latam-name-parser";

const customParser = new LatamNameParser({
  // Loads both Argentina and Mexico dictionaries
  dictionaries: [Dictionaries.AR, Dictionaries.MX],
  strategy: AR_STRATEGY
});
```

---

## Advanced Parse Options (New):

The .parse() method now accepts a second argument: ParseOptions. This allows you to handle edge cases found in unstructured databases.

- Inverted Format (Surname-First)
  Many legacy databases store names as [S1] [S2] [Names]. You can tell the parser to evaluate from left-to-right:

```
const input = "DE LA CRUZ DEL VALLE MARIA DE LOS ANGELES";

const result = parser.parse(input, {
  format: "surname-first"
});

// Result:
// givenName: "MARIA DE LOS ANGELES"
// surname1: "DE LA CRUZ"
// surname2: "DEL VALLE"

```

- Single Surname Systems (e.g., Argentina)
  Some countries officially use only one surname. You can instruct the parser to strictly protect the first surname and dump the rest into the given name.

```
import { AR_STRATEGY } from "latam-name-parser";

const parserAr = new LatamNameParser({
  dictionaries: [Dictionaries.AR],
  strategy: AR_STRATEGY
});

const result = parserAr.parse("JUAN CARLOS MARTIN DEL CAMPO", {
  expectedSurnames: 1
});

// Result:
// givenName: "JUAN CARLOS"
// surname1: "MARTIN DEL CAMPO"
// surname2: ""

```

---

## Anglicized Format Definitions:

The Anglicized Output Formats were designed to solve a common problem: many international systems do not handle spaces in surnames or dual surnames well. These formats provide different ways to represent the parsed name to ensure compatibility with various software requirements.

- `Natural`: Juan Carlos De La O Vargas (Remove "-" symbols)
- `Standard`: Juan Carlos De-La-O-Vargas (Ideal for Database integrity)
- `Full-Hyphen`: Juan-Carlos-De-La-O-Vargas (Ideal for emails/slugs)

```
const parsed = parser.parse("JUAN CARLOS DE LA O VARGAS");

// 1. Natural: Title-cased and cleaned of extra spaces
console.log(LatamNameParser.toNatural(parsed));
// "Juan Carlos De La O Vargas"

// 2. Standard: Hyphenates the surnames to trick US systems into reading it as a single Last Name
console.log(LatamNameParser.toStandard(parsed));
// "Juan Carlos De-La-O-Vargas"

// 3. Full-Hyphen: Hyphenates the entire name (Useful for URL slugs or strict ID systems)
console.log(LatamNameParser.toFullHyphen(parsed));
// "Juan-Carlos-De-La-O-Vargas"

```

---

## How it Works

### Latin American names are difficult because:

- Compound Surnames: "Cruz" is a surname, but "Santa Cruz" is also a surname.
- Ambiguous Middle Names: "Jesus" can be a name (María de Jesús) or a surname (De Jesús).
- Particles: "De", "La", "Del" appear everywhere.

### Our "Reverse Subtraction" Strategy:

- Compound Detection: We check the end of the string against a dictionary of compound surnames, sorted by length (longest first).
- Suffix Arbitration: If a compound candidate is found, a heuristic arbitrator decides if it's a valid surname or a Name-Surname collision based on statistical rarity.
- Subtraction: Once the Second Surname is identified and removed, we repeat the process for the First Surname.
- Remainder: Whatever is left is the Given Name(s).

---

## Data Sources

Our dictionaries are precision-engineered from open government data:

- `Argentina (AR)`: RENAPER (National Registry of Persons).
- `Costa Rica (CR)`: TSE (Supreme Electoral Tribunal).
- `Mexico (MX)`: PUB (Unified Beneficiary Roster).

---

## License

### MIT License. Feel free to use this in commercial or personal projects.

---
