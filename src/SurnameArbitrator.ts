import { CountryStrategy } from "./types";

export interface ArbitrationResult {
  movedToGivenName: boolean;
  newGivenName: string;
  newS1: string;
}

const VALID_SINGLE_LETTERS = new Set(["O", "D", "A"]);
const PARTICLES = /\b(DE|LA|LAS|LOS|DEL|Y|SAN|SANTA|VON|VAN|DA|DI)\b/;

export class SurnameArbitrator {
  private strategy: CountryStrategy;

  constructor(strategy: CountryStrategy) {
    this.strategy = strategy;
  }

  public arbitrate(
    givenName: string,
    surnameCandidate: string,
  ): ArbitrationResult {
    const s1 = surnameCandidate.trim();

    if (s1.length === 1 && !VALID_SINGLE_LETTERS.has(s1)) {
      return {
        movedToGivenName: true,
        newGivenName: `${givenName} ${s1}`.trim(),
        newS1: "",
      };
    }

    return {
      movedToGivenName: false,
      newGivenName: givenName,
      newS1: surnameCandidate,
    };
  }

  public isCommonGivenName(token: string): boolean {
    const upper = token.toUpperCase();
    return (
      this.strategy.givenNames.has(upper) ||
      (this.strategy.givenNamesBlacklist?.has(upper) ?? false)
    );
  }

  public isValid(candidate: string, remainingText: string): boolean {
    const upperCandidate = candidate.toUpperCase();
    const parts = upperCandidate.split(" ");
    const remainingTrimmed = remainingText.trim();
    const remainingWordCount = remainingTrimmed
      ? remainingTrimmed.split(/\s+/).length
      : 0;

    // 1. Whitelist ATÓMICA (Prioridad Máxima - Siempre se unen)
    if (this.strategy.compoundWhitelist?.has(upperCandidate)) return true;

    // 🔥 2. Whitelist AMBIGUA (Condicional - Válvula de Seguridad)
    if (this.strategy.ambiguousSurnames?.has(upperCandidate)) {
      // REGLA: Solo permitimos el compuesto ambiguo si sobran al menos 2 palabras
      // en el texto restante. Esto asegura que hay espacio para el Nombre y el S1.
      // (Previene que GARCIA DIAZ se coma el espacio del S1 en "JUAN GARCIA DIAZ")
      if (remainingWordCount >= 2) {
        return true;
      }
      // Si sobra 0 o 1 palabra, rechazamos el compuesto para forzar la división.
      return false;
    }

    // ... Resto de validaciones estándar (letras, partículas, etc.) ...

    if (parts.some((p) => p.length === 1 && !VALID_SINGLE_LETTERS.has(p))) {
      return false;
    }

    if (parts.length >= 2 && parts[0] === "DE" && parts[1] === "MARIA")
      return false;
    if (
      parts.length >= 2 &&
      parts[0] === "DE" &&
      (parts[1] === "JESUS" || parts[1] === "DIOS")
    )
      return false;

    if (
      (remainingTrimmed.toUpperCase().endsWith("DE LOS") ||
        remainingTrimmed.toUpperCase().endsWith("DEL")) &&
      (parts[0] === "ANGELES" ||
        parts[0] === "CARMEN" ||
        parts[0] === "ROSARIO" ||
        parts[0] === "PILAR" ||
        parts[0] === "SOCORRO")
    ) {
      return false;
    }

    if (PARTICLES.test(upperCandidate)) {
      if (
        this.strategy.commonSurnames.has(parts[0]) &&
        (parts[1] === "DEL" || parts[1] === "DE" || parts[1] === "LA")
      ) {
        return false;
      }
      if (
        upperCandidate.startsWith("DE LA O ") ||
        upperCandidate.startsWith("DE LA CRUZ ")
      ) {
        const lastWord = parts[parts.length - 1];
        if (this.strategy.commonSurnames.has(lastWord)) return false;
      }
      if (
        upperCandidate === "DE LA" ||
        upperCandidate === "DE LOS" ||
        upperCandidate === "DE"
      )
        return false;

      return true;
    }

    if (parts.length === 2) {
      const firstWordOfCompound = parts[0];
      if (this.strategy.givenNames.has(firstWordOfCompound)) {
        if (remainingWordCount === 1) {
          // Usamos la variable ya calculada
          const secondWordOfCompound = parts[1];
          if (!this.strategy.commonSurnames.has(secondWordOfCompound)) {
            return true;
          }
          return false;
        }
      }
    }

    if (parts.length === 2) {
      const w1 = parts[0];
      const w2 = parts[1];
      if (
        this.strategy.commonSurnames.has(w1) &&
        this.strategy.commonSurnames.has(w2)
      ) {
        return false;
      }
    }

    if (this.strategy.givenNamesBlacklist?.has(parts[0])) return false;
    if (parts.length === 2 && parts[0] === parts[1]) return false;

    return true;
  }
}
