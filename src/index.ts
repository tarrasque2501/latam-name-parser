import surnamesCr from "./data/surnames-cr.json";
import surnamesAr from "./data/surnames-ar.json";
import surnamesMx from "./data/surnames-mx.json";

export * from "./types";
export { LatamNameParser } from "./LatamNameParser";
export const Dictionaries = {
  CR: surnamesCr,
  AR: surnamesAr,
  MX: surnamesMx,
  LATAM: [...new Set([...surnamesCr, ...surnamesAr, ...surnamesMx])].sort(
    (a, b) => b.length - a.length,
  ),
};
export { CR_STRATEGY } from "./data/strategies/cr";
export { AR_STRATEGY } from "./data/strategies/ar";
export { MX_STRATEGY } from "./data/strategies/mx";
