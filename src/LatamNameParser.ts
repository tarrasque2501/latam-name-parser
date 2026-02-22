import { SurnameArbitrator } from "./SurnameArbitrator";
import {
  ParsedName,
  LatamParserOptions,
  AnglicizedName,
  ParseOptions,
} from "./types";

export class LatamNameParser {
  private compoundSet: Set<string>;
  private maxCompoundWords: number = 0;
  private arbitrator: SurnameArbitrator;

  constructor(options: LatamParserOptions) {
    const allCompounds = options.dictionaries
      .flat()
      .map((s) => s.trim().toUpperCase());

    if (options.strategy.compoundWhitelist) {
      options.strategy.compoundWhitelist.forEach((c) =>
        allCompounds.push(c.trim().toUpperCase()),
      );
    }

    if (options.strategy.ambiguousSurnames) {
      options.strategy.ambiguousSurnames.forEach((c) =>
        allCompounds.push(c.trim().toUpperCase()),
      );
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

  public parse(fullName: string, options: ParseOptions = {}): ParsedName {
    const tokens = fullName.trim().split(/\s+/);
    const isSurnameFirst = options.format === "surname-first";

    let result = this.executeInternalParse(fullName, true, isSurnameFirst);

    if (
      tokens.length >= 3 &&
      (result.surname1 === "" || result.surname2 === "")
    ) {
      const redemptionResult = this.executeInternalParse(
        fullName,
        false,
        isSurnameFirst,
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
    fullName: string,
    allowCompounds: boolean,
    isSurnameFirst: boolean = false,
  ): ParsedName {
    let currentString = fullName.trim().toUpperCase().replace(/\s+/g, " ");
    const originalName = currentString;

    let s1 = "";
    let s2 = "";
    let givenName = "";
    let isCompound = false;

    if (isSurnameFirst) {
      // ==========================================
      // LÓGICA DE IZQUIERDA A DERECHA (Surname-First)
      // ==========================================

      // 1. Encontrar Apellido 1 (Prefijo)
      const foundS1 = allowCompounds
        ? this.findCompoundPrefixOptimized(currentString)
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

      // 2. Encontrar Apellido 2 (Prefijo del resto)
      const foundS2 = allowCompounds
        ? this.findCompoundPrefixOptimized(currentString)
        : null;
      if (foundS2) {
        s2 = foundS2;
        currentString = currentString.slice(s2.length).trim();
        isCompound = true;
      } else {
        const firstSpace = currentString.indexOf(" ");
        // Si hay más de una palabra, la primera es Apellido 2 y el resto Nombre(s)
        if (firstSpace !== -1 && currentString.length > 0) {
          s2 = currentString.slice(0, firstSpace);
          currentString = currentString.slice(firstSpace + 1).trim();
        }
      }

      // 3. Lo que sobra son los nombres
      givenName = currentString;

      // Salvavidas: Si no sobró nombre, el S2 probablemente era el nombre
      if (!givenName && s2) {
        givenName = s2;
        s2 = "";
      }
    } else {
      // ==========================================
      // LÓGICA DE DERECHA A IZQUIERDA (Natural)
      // ==========================================

      const foundS2 = allowCompounds
        ? this.findCompoundSuffixOptimized(currentString)
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

      const foundS1 = allowCompounds
        ? this.findCompoundSuffixOptimized(currentString)
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
        }
      }

      givenName = currentString;
      if (!givenName && s1) {
        givenName = s1;
        s1 = s2;
        s2 = "";
      }
    }

    const arbitration = this.arbitrator.arbitrate(givenName, s1);

    return {
      fullName: originalName,
      givenName: arbitration.newGivenName,
      surname1: arbitration.newS1,
      surname2: s2,
      isCompound: allowCompounds ? isCompound : false,
    };
  }

  // ============================================================
  // BUSCADORES DE COMPUESTOS
  // ============================================================

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

  // NUEVO: Busca compuestos de Izquierda a Derecha
  private findCompoundPrefixOptimized(text: string): string | null {
    const tokens = text.split(" ");
    if (tokens.length < 2) return null;
    const maxWordsToCheck = Math.min(tokens.length, this.maxCompoundWords);

    for (let i = maxWordsToCheck; i >= 2; i--) {
      const candidate = tokens.slice(0, i).join(" ");
      if (this.compoundSet.has(candidate)) {
        const remainingText = tokens.slice(i).join(" ");
        // isValid puede evaluar el restante de manera genérica
        if (this.arbitrator.isValid(candidate, remainingText)) {
          return candidate;
        }
      }
    }
    return null;
  }

  // ============================================================
  // MÉTODOS DE FORMATEO (INCLUYENDO MÉTODOS ANGLO)
  // ============================================================

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

    // Unimos los apellidos y limpiamos guiones extra (por si falta el s2)
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
