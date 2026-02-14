# Latam Name Parser

[![NPM Version](https://img.shields.io/npm/v/latam-name-parser?style=for-the-badge&color=blue)](https://www.npmjs.com/package/latam-name-parser)
[![Downloads](https://img.shields.io/npm/dt/latam-name-parser?style=for-the-badge&color=green)](https://www.npmjs.com/package/latam-name-parser)
[![License](https://img.shields.io/npm/l/latam-name-parser?style=for-the-badge&color=orange)](https://github.com/tarrasque2501/latam-name-parser/blob/main/LICENSE)

> **New in v1.2.0:** Major accuracy boost! We have successfully stress-tested the parser against **4,094,359 real records** (full Costa Rica Electoral Roll).
>
> - **Accuracy:** 99.9928% (Only 295 edge cases out of 4.1 million).
> - **Speed:** ~112,000 names/second.

A specialized, high-performance parser designed for the complexity of **Latin American identities**. Unlike simple splitters, it uses a **"Reverse Subtraction"** strategy and regionally-mined dictionaries to correctly identify compound surnames (e.g., _De La O_, _Montes de Oca_) and dual surnames.

---

## Benchmarks & Validation

This library isn't just based on grammatical rules; it is **data-mined**. We validate our logic against massive, real-world government datasets to ensure production readiness.

| Metric         | Result                 | Dataset                                                     |
| :------------- | :--------------------- | :---------------------------------------------------------- |
| **Accuracy**   | **99.9928%**           | Costa Rica Padron Electoral (4.1M records)                  |
| **Speed**      | **~112,000 names/sec** | Single-threaded, Node.js v20                                |
| **Edge Cases** | **< 0.008%**           | Mostly typos in official registries or rare religious names |

---

## Installation

Install the package via your favorite package manager:

```
npm install latam-name-parser
```

---

## Usage

**Basic Implementation**
Import the parser and use the LATAM dictionary set for maximum coverage across all supported countries.

```
import { LatamNameParser, Dictionaries } from "latam-name-parser";

// Initialize with full Latin American coverage
const parser = new LatamNameParser({
dictionaries: [Dictionaries.LATAM]
});

const input = "MARIA DEL CARMEN GUTIERREZ DE PIÑERES RENAULD";
const parsed = parser.parse(input);

console.log(parsed);
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

Performance Optimization (Specific Countries)
If you only need to process data from a specific region (e.g., Costa Rica), you can load only that dictionary to gain a slight performance boost and reduce "noise" from other regions.

```
import { LatamNameParser, Dictionaries } from "latam-name-parser";

// Optimized for Costa Rica (CR)
const parser = new LatamNameParser({
dictionaries: [Dictionaries.CR]
});

const result = parser.parse("JUAN CARLOS DE LA O VARGAS");
// Result: { givenName: "JUAN CARLOS", surname1: "DE LA O", surname2: "VARGAS" }
```

---

## Anglicized Format Definitions:

The Anglicized Output Formats were designed to solve a common problem: many international systems do not handle spaces in surnames or dual surnames well. These formats provide different ways to represent the parsed name to ensure compatibility with various software requirements.

- `Natural`: Juan Carlos De La O Vargas (Remove "-" symbols)
- `Standard`: Juan Carlos De-La-O-Vargas (Ideal for Database integrity)
- `Full-Hyphen`: Juan-Carlos-De-La-O-Vargas (Ideal for emails/slugs)

```
import { LatamNameParser, Dictionaries } from "latam-name-parser";

const parser = new LatamNameParser({ dictionaries: [Dictionaries.CR] });
const input = "Juan Carlos De La O Vargas";
const parsed = parser.parse(input);

// givenName: "Juan Carlos"
// surname1: "De La O" (Saved by our VALID_SINGLE_LETTERS rule)
// surname2: "Vargas"

console.log(parsed.toNatural());
console.log(parsed.toStandard());
console.log(parsed.toFullHyphen());

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
