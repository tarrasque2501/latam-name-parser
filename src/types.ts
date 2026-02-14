export interface ParsedName {
  fullName: string;
  givenName: string;
  surname1: string;
  surname2: string;
  isCompound: boolean;

  toNatural(): string;
  toStandard(): string;
  toFullHyphen(): string;
}

export type OutputFormat = "hyphenated-full" | "hyphenated-surname" | "natural";

export interface AnglicizedName {
  givenName: string;
  surname: string;
  fullName: string;
}

export interface LatamParserOptions {
  dictionaries: string[][];
  debug?: boolean;
}
