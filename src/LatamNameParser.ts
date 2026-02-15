import { SurnameArbitrator } from "./SurnameArbitrator";
import { ParsedName, LatamParserOptions } from "./types";

export class LatamNameParser {
  private compoundSet: Set<string>;
  private maxCompoundWords: number = 0;
  private arbitrator: SurnameArbitrator;

  constructor(options: LatamParserOptions) {
    const allCompounds = options.dictionaries
      .flat()
      .map((s) => s.trim().toUpperCase());

    this.compoundSet = new Set(allCompounds);
    this.arbitrator = new SurnameArbitrator();

    this.maxCompoundWords = allCompounds.reduce((max, current) => {
      const words = current.split(" ").length;
      return words > max ? words : max;
    }, 0);
  }

  public parse(fullName: string): ParsedName {
    let currentString = fullName.trim().toUpperCase().replace(/\s+/g, " ");
    const originalName = currentString;

    let s1 = "";
    let s2 = "";
    let isCompound = false;

    const foundS2 = this.findCompoundSuffixOptimized(currentString);
    if (foundS2) {
      s2 = foundS2;
      currentString = currentString
        .substring(0, currentString.length - s2.length)
        .trim();
      isCompound = true;
    } else {
      const parts = currentString.split(" ");
      if (parts.length > 1) {
        s2 = parts.pop() || "";
        currentString = parts.join(" ");
      }
    }

    const foundS1 = this.findCompoundSuffixOptimized(currentString);
    if (foundS1) {
      s1 = foundS1;
      currentString = currentString
        .substring(0, currentString.length - s1.length)
        .trim();
      isCompound = true;
    } else {
      const parts = currentString.split(" ");
      if (parts.length >= 1 && currentString !== "") {
        s1 = parts.pop() || "";
        currentString = parts.join(" ");
      }
    }

    let finalGiven = currentString;
    let finalS1 = s1;
    let finalS2 = s2;

    if (!finalGiven && finalS1) {
      finalGiven = finalS1;
      finalS1 = finalS2;
      finalS2 = "";
    }

    const fmtGiven = this.formatTitleCase(finalGiven);
    const fmtS1 = this.formatTitleCase(finalS1);
    const fmtS2 = this.formatTitleCase(finalS2);
    const fmtFull = this.formatTitleCase(originalName);

    return {
      fullName: fmtFull,
      givenName: fmtGiven,
      surname1: fmtS1,
      surname2: fmtS2,
      isCompound,
      toNatural: function () {
        return `${this.givenName} ${this.surname1} ${this.surname2}`
          .replace(/-/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      },
      toStandard: function () {
        const s1Hyphen = this.surname1.replace(/\s+/g, "-");
        const s2Hyphen = this.surname2.replace(/\s+/g, "-");
        let united = `${s1Hyphen}-${s2Hyphen}`
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        return `${this.givenName} ${united}`.trim();
      },
      toFullHyphen: function () {
        return `${this.givenName} ${this.surname1} ${this.surname2}`
          .trim()
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");
      },
    };
  }

  private formatTitleCase(str: string): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  private findCompoundSuffixOptimized(text: string): string | null {
    const tokens = text.split(" ");
    if (tokens.length < 2) return null;

    const maxWordsToCheck = Math.min(tokens.length, this.maxCompoundWords);

    for (let i = maxWordsToCheck; i >= 2; i--) {
      const candidate = tokens.slice(-i).join(" ");
      const remainingText = tokens.slice(0, tokens.length - i).join(" ");

      if (this.compoundSet.has(candidate)) {
        if (this.arbitrator.isValid(candidate, remainingText)) {
          return candidate;
        }
      }
    }
    return null;
  }
}
