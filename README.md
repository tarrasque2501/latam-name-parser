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

## Dictionaries & Data Sources

The core accuracy of this library comes from real-world data mining, not just grammatical rules.

- **Costa Rica (CR)**:
  - Source: Official electoral rolls (Padron Electoral) from the Supreme Electoral Tribunal (TSE).
  - Dataset Composition: Consolidated data from the years 2011, 2012, 2013, 2015, 2017, 2021, 2022, and 2026.
  - Source URL: https://www.tse.go.cr/descarga_padron.html

_More countries coming soon._

## Installation (Coming Soon)

```bash
npm install latam-name-parser
```
