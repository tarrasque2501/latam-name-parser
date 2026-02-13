import { LatamNameParser, Dictionaries } from "./src";

console.log("Iniciando pruebas de LatamNameParser...\n");

const parser = new LatamNameParser({
  dictionaries: [Dictionaries.CR],
  debug: true,
});

const testCases = [
  "JUAN CARLOS DE LA GOUBLAYE DE MENORVAL PEREZ",
  "MARIA TERESA CORNET D ELZIUS DE PEISSAN ESPINOZA DE LOS MONTEROS",
  "OMAR ISSA EL KHOURY DE LA ESPRIELLA",
  "ANA LUCIA DA VERA CRUZ LA O",
  "FRANCISCO JAVIER SANCHEZ DE LAS MATAS ALVAREZ DEL CASTILLO",
  "WILLEM VAN DE NIEUWENHUIZEN RODRIGUEZ JAUREGUI",
  "RODRIGO ALEXANDER GARCIA MANSIL LOBATO MARTINEZ",
  "MARIA FERNANDA YOUSEFI DIZAGETAKIEH TALLIEN DE CABARRUS",
  "RICARDO MARQUES DA SILVA PAULO DA SILVA",
  "Alberto Arias Sáenz",
  "ESTEBAN LARCHEVESQUE",
  "ESTEBAN DE LA O",
  "Prince",
];

testCases.forEach((nombre) => {
  const result = parser.parse(nombre);
  const natural = parser.getAnglicizedFormat(result, "natural");
  const standard = parser.getAnglicizedFormat(result, "hyphenated-surname");
  const full = parser.getAnglicizedFormat(result, "hyphenated-full");

  console.log(`Procesando: "${nombre}"`);
  console.log(` `);
  console.log(`> Given Name:  [${result.givenName}]`);
  console.log(`> Surname 1:   [${result.surname1}]`);
  console.log(`> Surname 2:   [${result.surname2}]`);
  console.log(` `);
  console.log(`> Natural: ${natural.fullName}`);
  console.log(
    `  (Parts): Given: "${natural.givenName}" | Surname: "${natural.surname}"`,
  );
  console.log(` `);
  console.log(`> US Standard: ${standard.fullName}`);
  console.log(
    `  (Parts): Given: "${standard.givenName}" | Surname: "${standard.surname}"`,
  );
  console.log(` `);
  console.log(`> Full-Hyph:  ${full.fullName}`);
  console.log(
    `  (Parts): Given: "${full.givenName}" | Surname: "${full.surname}"`,
  );
  console.log("---------------------------------------------------");
});
