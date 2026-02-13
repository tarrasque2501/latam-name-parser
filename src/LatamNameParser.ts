import {
  ParsedName,
  LatamParserOptions,
  AnglicizedName,
  OutputFormat,
} from "./types";

export class LatamNameParser {
  private compoundSet: Set<string>;
  private maxCompoundWords: number = 0;

  constructor(options: LatamParserOptions) {
    const allCompounds = options.dictionaries
      .flat()
      .map((s) => s.trim().toUpperCase());

    this.compoundSet = new Set(allCompounds);

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

    return {
      fullName: originalName,
      givenName: finalGiven,
      surname1: finalS1,
      surname2: finalS2,
      isCompound,
    };
  }

  public getAnglicizedFormat(
    parsed: ParsedName,
    format: OutputFormat = "hyphenated-surname",
  ): AnglicizedName {
    const { givenName, surname1, surname2 } = parsed;
    const toTitleCase = (str: string) =>
      str.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
    const hyphenate = (str: string) => str.replace(/\s+/g, "-");

    let finalGiven = toTitleCase(givenName);
    let finalS1 = toTitleCase(surname1);
    let finalS2 = toTitleCase(surname2);

    switch (format) {
      case "hyphenated-full":
        finalGiven = hyphenate(finalGiven);
        finalS1 = hyphenate(finalS1);
        finalS2 = hyphenate(finalS2);
        break;
      case "hyphenated-surname":
        finalS1 = hyphenate(finalS1);
        finalS2 = hyphenate(finalS2);
        break;
      case "natural":
        break;
    }

    let unitedSurname = "";
    const separator = format === "natural" ? " " : "-";

    if (finalS1 && finalS2) {
      unitedSurname = `${finalS1}${separator}${finalS2}`;
    } else {
      unitedSurname = finalS1;
    }

    const full = finalGiven ? `${finalGiven} ${unitedSurname}` : unitedSurname;

    return {
      givenName: finalGiven,
      surname: unitedSurname,
      fullName: full.trim(),
    };
  }

  private findCompoundSuffixOptimized(text: string): string | null {
    const tokens = text.split(" ");
    if (tokens.length < 2) return null;

    const maxWordsToCheck = Math.min(tokens.length, this.maxCompoundWords);

    for (let i = maxWordsToCheck; i >= 2; i--) {
      const candidate = tokens.slice(-i).join(" ");
      if (this.compoundSet.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }
}
