# Latam Name Parser

A name parser specifically designed for the complexity of Latin American identities. It uses a "Reverse Subtraction with Anchoring" strategy and compound surname dictionaries to ensure accuracy superior to standard Anglo-Saxon libraries.

## Features

- **Optimized Greedy Algorithm (O(1))**: Detects compound surnames of up to 5 words (e.g., "De La Goublaye De Menorval") with zero performance impact.

- **Positional Logic Support**: Agnostic to cultural naming conventions (Spanish vs. Portuguese). It strictly identifies **Surname 1** (Left) and **Surname 2** (Right) based on dictionary matching, solving edge cases for both Brazil and the rest of LATAM.

- **Output Formats**:
  - `Natural`: Juan Carlos De La O Vargas
  - `Standard`: Juan Carlos De-La-O-Vargas (Ideal for Database integrity)
  - `Full-Hyphen`: Juan-Carlos De-La-O-Vargas (Ideal for emails/slugs)
- **Zero Dependencies**: Written in pure TypeScript.

## 📦 Installation (Coming Soon)

```bash
npm install latam-name-parser
```
