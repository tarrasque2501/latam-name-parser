export type NameFormat = "natural" | "surname-first";
export type OutputFormat = "hyphenated-full" | "hyphenated-surname" | "natural";

export interface ParseOptions {
  format?: NameFormat;
}

export interface ParsedName {
  fullName: string;
  givenName: string;
  surname1: string;
  surname2: string;
  isCompound: boolean;
}

export interface AnglicizedName {
  givenName: string;
  surname: string;
  fullName: string;
}

export interface LatamParserOptions {
  dictionaries: string[][];
  strategy: CountryStrategy;
  debug?: boolean;
}

export interface CountryStrategy {
  commonSurnames: Set<string>;
  givenNamesBlacklist: Set<string>;
  compoundWhitelist: Set<string>;
  ambiguousSurnames?: Set<string>;
  givenNames: Set<string>;
}
