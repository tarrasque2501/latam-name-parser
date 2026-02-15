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
    this.arbitrator = new SurnameArbitrator(options.givenNames);

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
      currentString = currentString.slice(0, -s2.length).trim();
      isCompound = true;
    } else {
      const lastSpace = currentString.lastIndexOf(" ");
      if (lastSpace !== -1) {
        s2 = currentString.slice(lastSpace + 1);
        currentString = currentString.slice(0, lastSpace);
      }
    }

    const foundS1 = this.findCompoundSuffixOptimized(currentString);
    if (foundS1) {
      s1 = foundS1;
      currentString = currentString.slice(0, -s1.length).trim();
      isCompound = true;
    } else {
      const lastSpace = currentString.lastIndexOf(" ");
      if (lastSpace !== -1 && currentString.length > 0) {
        s1 = currentString.slice(lastSpace + 1);
        currentString = currentString.slice(0, lastSpace);
      }
    }

    let givenName = currentString;

    if (!givenName && s1) {
      givenName = s1;
      s1 = s2;
      s2 = "";
    }

    const arbitration = this.arbitrator.arbitrate(givenName, s1);
    if (arbitration.movedToGivenName) {
      givenName = arbitration.newGivenName;
      s1 = arbitration.newS1;
    }

    return {
      fullName: originalName,
      givenName: givenName,
      surname1: s1,
      surname2: s2,
      isCompound,
    };
  }

  public static toNatural(parsed: ParsedName): string {
    const raw = `${parsed.givenName} ${parsed.surname1} ${parsed.surname2}`
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return LatamNameParser.formatTitleCase(raw);
  }

  public static toStandard(parsed: ParsedName): string {
    const gn = LatamNameParser.formatTitleCase(parsed.givenName);
    const s1 = LatamNameParser.formatTitleCase(parsed.surname1).replace(
      /\s+/g,
      "-",
    );
    const s2 = LatamNameParser.formatTitleCase(parsed.surname2).replace(
      /\s+/g,
      "-",
    );

    const united = `${s1}-${s2}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
    return `${gn} ${united}`.trim();
  }

  public static toFullHyphen(parsed: ParsedName): string {
    const raw = `${parsed.givenName} ${parsed.surname1} ${parsed.surname2}`;
    return LatamNameParser.formatTitleCase(raw)
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  private static formatTitleCase(str: string): string {
    if (!str) return "";
    const particles = new Set([
      "DE",
      "LA",
      "DEL",
      "LOS",
      "LAS",
      "Y",
      "DA",
      "DOS",
      "DAS",
      "DO",
      "VON",
      "VAN",
      "DER",
      "SAN",
      "SANTA",
    ]);
    return str
      .toLowerCase()
      .split(" ")
      .map((word, index) => {
        const upper = word.toUpperCase();
        if (index > 0 && particles.has(upper)) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  private findCompoundSuffixOptimized(text: string): string | null {
    const tokens = text.split(" ");
    if (tokens.length < 2) return null;

    const maxWordsToCheck = Math.min(tokens.length, this.maxCompoundWords);

    for (let i = maxWordsToCheck; i >= 2; i--) {
      const candidate = tokens.slice(-i).join(" ");

      if (this.compoundSet.has(candidate)) {
        const remainingText = tokens.slice(0, tokens.length - i).join(" ");

        if (this.arbitrator.isValid(candidate, remainingText)) {
          return candidate;
        }
      }
    }
    return null;
  }
}
