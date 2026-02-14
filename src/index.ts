import surnamesCr from "./data/surnames-cr.json";
import surnamesAr from "./data/surnames-ar.json";
import surnamesMx from "./data/surnames-mx.json";

export * from "./types";
export const Dictionaries = {
  CR: surnamesCr,
  AR: surnamesAr,
  MX: surnamesMx,
  LATAM: [...new Set([...surnamesCr, ...surnamesAr, ...surnamesMx])].sort(
    (a, b) => b.length - a.length,
  ),
};
export { LatamNameParser } from "./LatamNameParser";
