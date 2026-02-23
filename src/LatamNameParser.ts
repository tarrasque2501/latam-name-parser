import { SurnameArbitrator } from "./SurnameArbitrator";
import { ParsedName, LatamParserOptions, ParseOptions } from "./types";

export class LatamNameParser {
  private compoundSet: Set<string>;
  private maxCompoundWords: number = 0;
  private arbitrator: SurnameArbitrator;

  constructor(options: LatamParserOptions) {
    const allCompounds = options.dictionaries
      .flat()
      .filter((s) => typeof s === "string" && s !== null)
      .map((s) => s.trim().toUpperCase());

    if (options.strategy.compoundWhitelist) {
      options.strategy.compoundWhitelist.forEach((c) => {
        if (typeof c === "string") {
          allCompounds.push(c.trim().toUpperCase());
        }
      });
    }

    if (options.strategy.ambiguousSurnames) {
      options.strategy.ambiguousSurnames.forEach((c) => {
        if (typeof c === "string") {
          allCompounds.push(c.trim().toUpperCase());
        }
      });
    }

    const particles = [
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
    ];
    particles.forEach((p) => allCompounds.push(p));

    this.compoundSet = new Set(allCompounds);
    this.arbitrator = new SurnameArbitrator(options.strategy);

    this.maxCompoundWords = allCompounds.reduce((max, current) => {
      const words = current.split(" ").length;
      return words > max ? words : max;
    }, 0);
  }

  public parse(fullName: string, options?: ParseOptions): ParsedName {
    let cleanName = fullName.trim().toUpperCase();
    if (cleanName.includes("  ")) {
      cleanName = cleanName.replace(/\s+/g, " ");
    }

    if (!cleanName) {
      return {
        fullName,
        givenName: "",
        surname1: "",
        surname2: "",
        isCompound: false,
      };
    }

    const isSurnameFirst = options?.format === "surname-first";
    const expectedSurnames = options?.expectedSurnames ?? 2;

    let result = this.executeInternalParse(
      cleanName,
      true,
      isSurnameFirst,
      expectedSurnames,
    );

    let needsRedemption = false;
    if (
      expectedSurnames === 2 &&
      (result.surname1 === "" || result.surname2 === "")
    ) {
      const firstSpace = cleanName.indexOf(" ");
      if (firstSpace !== -1 && cleanName.indexOf(" ", firstSpace + 1) !== -1) {
        needsRedemption = true;
      }
    } else if (expectedSurnames === 1 && result.surname1 === "") {
      if (cleanName.indexOf(" ") !== -1) {
        needsRedemption = true;
      }
    }

    if (needsRedemption) {
      const redemptionResult = this.executeInternalParse(
        cleanName,
        false,
        isSurnameFirst,
        expectedSurnames,
      );
      const fieldsFilled = (r: ParsedName) =>
        (r.surname1 ? 1 : 0) + (r.surname2 ? 1 : 0);

      if (fieldsFilled(redemptionResult) > fieldsFilled(result)) {
        return redemptionResult;
      }
    }

    return result;
  }

  private executeInternalParse(
    cleanName: string,
    allowCompounds: boolean,
    isSurnameFirst: boolean,
    expectedSurnames: number,
  ): ParsedName {
    let currentString = cleanName;
    const originalName = currentString;

    let s1 = "";
    let s2 = "";
    let givenName = "";
    let isCompound = false;

    if (isSurnameFirst) {
      const foundS1 = allowCompounds
        ? this.findCompoundPrefixOptimized(currentString, expectedSurnames)
        : null;
      if (foundS1) {
        s1 = foundS1;
        currentString = currentString.slice(s1.length).trim();
        isCompound = true;
      } else {
        const firstSpace = currentString.indexOf(" ");
        if (firstSpace !== -1) {
          s1 = currentString.slice(0, firstSpace);
          currentString = currentString.slice(firstSpace + 1).trim();
        } else {
          s1 = currentString;
          currentString = "";
        }
      }

      if (expectedSurnames === 2) {
        const foundS2 = allowCompounds
          ? this.findCompoundPrefixOptimized(currentString, expectedSurnames)
          : null;
        if (foundS2) {
          s2 = foundS2;
          currentString = currentString.slice(s2.length).trim();
          isCompound = true;
        } else {
          const firstSpace = currentString.indexOf(" ");
          if (firstSpace !== -1 && currentString.length > 0) {
            s2 = currentString.slice(0, firstSpace);
            currentString = currentString.slice(firstSpace + 1).trim();
          }
        }
      }

      givenName = currentString;
      if (!givenName && s1 && expectedSurnames === 2 && s2) {
        givenName = s2;
        s2 = "";
      } else if (!givenName && s1 && expectedSurnames === 1) {
        givenName = s1;
        s1 = "";
      }
    } else {
      if (expectedSurnames === 2) {
        const foundS2 = allowCompounds
          ? this.findCompoundSuffixOptimized(currentString, expectedSurnames)
          : null;
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
      }

      const foundS1 = allowCompounds
        ? this.findCompoundSuffixOptimized(currentString, expectedSurnames)
        : null;
      if (foundS1) {
        s1 = foundS1;
        currentString = currentString.slice(0, -s1.length).trim();
        isCompound = true;
      } else {
        const lastSpace = currentString.lastIndexOf(" ");
        if (lastSpace !== -1 && currentString.length > 0) {
          s1 = currentString.slice(lastSpace + 1);
          currentString = currentString.slice(0, lastSpace);
        } else {
          s1 = currentString;
          currentString = "";
        }
      }

      givenName = currentString;

      if (!givenName && s1 && expectedSurnames === 2) {
        givenName = s1;
        s1 = s2;
        s2 = "";
      } else if (!givenName && s1 && expectedSurnames === 1) {
        givenName = s1;
        s1 = "";
      }
    }

    const arbitration = this.arbitrator.arbitrate(
      givenName,
      s1,
      expectedSurnames,
    );

    return {
      fullName: originalName,
      givenName: arbitration.newGivenName,
      surname1: arbitration.newS1,
      surname2: s2,
      isCompound: allowCompounds ? isCompound : false,
    };
  }

  private findCompoundSuffixOptimized(
    text: string,
    expectedSurnames: number,
  ): string | null {
    let spaceIdx = text.lastIndexOf(" ");
    if (spaceIdx === -1) return null;

    const spaces: number[] = [];
    while (spaceIdx !== -1 && spaces.length < this.maxCompoundWords) {
      spaces.push(spaceIdx);
      spaceIdx = text.lastIndexOf(" ", spaceIdx - 1);
    }

    if (spaceIdx === -1 && spaces.length < this.maxCompoundWords) {
      if (this.compoundSet.has(text)) {
        if (this.arbitrator.isValid(text, "", expectedSurnames)) {
          return text;
        }
      }
    }

    for (let i = spaces.length - 1; i >= 1; i--) {
      const cutIndex = spaces[i];
      const candidate = text.substring(cutIndex + 1);

      if (this.compoundSet.has(candidate)) {
        const remainingText = text.substring(0, cutIndex);
        if (
          this.arbitrator.isValid(candidate, remainingText, expectedSurnames)
        ) {
          return candidate;
        }
      }
    }
    return null;
  }

  private findCompoundPrefixOptimized(
    text: string,
    expectedSurnames: number,
  ): string | null {
    let spaceIdx = text.indexOf(" ");
    if (spaceIdx === -1) return null;

    const spaces: number[] = [];
    while (spaceIdx !== -1 && spaces.length < this.maxCompoundWords) {
      spaces.push(spaceIdx);
      spaceIdx = text.indexOf(" ", spaceIdx + 1);
    }

    if (spaceIdx === -1 && spaces.length < this.maxCompoundWords) {
      if (this.compoundSet.has(text)) {
        if (this.arbitrator.isValid(text, "", expectedSurnames)) {
          return text;
        }
      }
    }

    for (let i = spaces.length - 1; i >= 1; i--) {
      const cutIndex = spaces[i];
      const candidate = text.substring(0, cutIndex);

      if (this.compoundSet.has(candidate)) {
        const remainingText = text.substring(cutIndex + 1);
        if (
          this.arbitrator.isValid(candidate, remainingText, expectedSurnames)
        ) {
          return candidate;
        }
      }
    }
    return null;
  }

  public static toNatural(parsed: ParsedName): string {
    return `${parsed.givenName} ${parsed.surname1} ${parsed.surname2}`
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  public static toStandard(parsed: ParsedName): string {
    const gn = parsed.givenName;
    const s1 = parsed.surname1.replace(/\s+/g, "-");
    const s2 = parsed.surname2.replace(/\s+/g, "-");

    const unitedSurnames = `${s1}-${s2}`
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${gn} ${unitedSurnames}`.trim();
  }

  public static toFullHyphen(parsed: ParsedName): string {
    const standard = LatamNameParser.toStandard(parsed);
    return standard.replace(/\s+/g, "-");
  }
}
