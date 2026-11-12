// comprobar.mjs — El comprobador de la batería de la UD4 (opcional, no cuenta para nota). Se lanza con:
//     ./bateria.sh comprobar        (todos los bloques)
//     ./bateria.sh comprobar 3      (solo el bloque 3)
// Compila tu SCSS y revisa el CSS que sale. Te dice qué está bien y qué falta, NO la solución.
// La prueba del acordeón (estrechar de 1440 a 320 sin scroll horizontal) la haces tú en el navegador.
//
//   node comprobador/comprobar.mjs [N]       → resumen con colores
//   node comprobador/comprobar.mjs --json    → resultado en JSON
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");
const SOLO = process.argv.slice(2).find((a) => /^[0-4G]$/i.test(a))?.toUpperCase();
const color = process.stdout.isTTY && !JSON_OUT;
const c = (n, t) => (color ? `\x1b[${n}m${t}\x1b[0m` : t);

// ───────────── un parser de CSS mínimo (para el CSS «expanded» que genera Sass) ─────────────
function parsear(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  function bloque() {
    const nodos = [];
    let buf = "";
    while (i < css.length) {
      const ch = css[i++];
      if (ch === "{") {
        const cabeza = buf.trim();
        buf = "";
        if (cabeza.startsWith("@")) {
          const [, nombre, params] = cabeza.match(/^@([\w-]+)\s*(.*)$/s);
          nodos.push({ tipo: "at", nombre, params: params.trim(), hijos: bloque() });
        } else {
          const decls = [];
          const hijos = bloque();
          for (const h of hijos) if (h.tipo === "decl") decls.push(h);
          nodos.push({ tipo: "regla", selectores: cabeza.split(",").map((s) => s.trim()), decls, hijos });
        }
      } else if (ch === "}") {
        if (buf.trim()) nodos.push(decl(buf));
        return nodos;
      } else if (ch === ";") {
        if (buf.trim()) nodos.push(decl(buf));
        buf = "";
      } else buf += ch;
    }
    return nodos;
  }
  const decl = (t) => {
    const k = t.indexOf(":");
    return { tipo: "decl", prop: t.slice(0, k).trim().toLowerCase(), valor: t.slice(k + 1).trim() };
  };
  return bloque();
}

// Todas las reglas con su contexto (las @media / @container que las rodean)
function aplanar(nodos, ctx = [], salida = []) {
  for (const n of nodos) {
    if (n.tipo === "at") aplanar(n.hijos, [...ctx, n], salida);
    else if (n.tipo === "regla") salida.push({ ...n, ctx });
  }
  return salida;
}

// ───────────── compilar ─────────────
let reglas = [];
let errorCompilar = null;
let css = "";
try {
  const sass = await import("sass");
  css = sass.compile(join(RAIZ, "scss/main.scss"), { style: "expanded" }).css;
  reglas = aplanar(parsear(css));
} catch (e) {
  errorCompilar = e.message.split("\n").slice(0, 6).join("\n");
}

const fuentes = {};
(function leer(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, f.name);
    if (f.isDirectory()) leer(ruta);
    else if (f.name.endsWith(".scss")) fuentes[ruta.slice(RAIZ.length + 1)] = readFileSync(ruta, "utf8");
  }
})(join(RAIZ, "scss"));
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// ───────────── utilidades para las pruebas ─────────────
const esMedia = (r) => r.ctx.some((a) => a.nombre === "media");
const esContainer = (r) => r.ctx.some((a) => a.nombre === "container");
const minWidth = (a) => a.params.match(/min-width:\s*([\d.]+)(px|rem|em)/);
const enPx = (m) => (m ? Number(m[1]) * (m[2] === "px" ? 1 : 16) : null);

/** Valor de `prop` en las reglas cuyo selector es exactamente `sel`, con un filtro de contexto */
function valor(sel, prop, filtro = (r) => !esMedia(r) && !esContainer(r)) {
  let v = null;
  for (const r of reglas) {
    if (!r.selectores.includes(sel) || !filtro(r)) continue;
    for (const d of r.decls) if (d.prop === prop) v = d.valor;
  }
  return v;
}
const desde = (px) => (r) => r.ctx.some((a) => a.nombre === "media" && enPx(minWidth(a)) === px);
const enAlgunaMedia = (r) => r.ctx.some((a) => a.nombre === "media" && minWidth(a));
const areas = (v) => (v ? [...v.matchAll(/"([^"]*)"/g)].map((m) => m[1].trim().split(/\s+/)) : null);

const BP_MD = 600;
const BP_LG = 1000;
const HIJOS = { ".cabecera": "cabecera", ".principal": "principal", ".filtros": "filtros", ".pie": "pie" };

// Cada prueba devuelve true (bien) o un texto con lo que falla
const PRUEBAS = [
  // 0 · lo que ya está hecho: si sale en rojo, has roto algo
  ["0", "👀 El SCSS compila sin errores", () => (errorCompilar ? `Sass dice:\n${errorCompilar}` : true)],
  ["0", "👀 box-sizing: border-box para todo (ya hecho)", () =>
    reglas.some((r) => r.selectores.includes("*") && r.decls.some((d) => d.prop === "box-sizing" && d.valor === "border-box")) || "Has borrado el reset de _base.scss"],
  ["0", "👀 La cabecera: columna en móvil y fila desde 600px (el ejemplo)", () =>
    (valor(".cabecera", "flex-direction") === "column" && valor(".cabecera", "flex-direction", desde(BP_MD)) === "row") || "Has tocado el ejemplo de _cabecera.scss"],

  // 1 · layout
  ["1", ".pagina es un grid con grid-template-areas (móvil, sin media query)", () =>
    (valor(".pagina", "display") === "grid" && areas(valor(".pagina", "grid-template-areas"))?.length > 0) ||
    "A .pagina le falta display: grid o grid-template-areas fuera de la media query"],
  ["1", "Móvil: una columna, en el orden cabecera / filtros / principal / pie", () => {
    const a = areas(valor(".pagina", "grid-template-areas"));
    if (!a) return "No encuentro grid-template-areas en la versión móvil";
    if (a.some((f) => f.length !== 1)) return "En móvil cada fila del mapa debe tener UNA sola palabra";
    const orden = a.map((f) => f[0]).filter((x, i, arr) => arr.indexOf(x) === i).join(" / ");
    return orden === "cabecera / filtros / principal / pie" || `El orden es «${orden}»`;
  }],
  ["1", "Desde 600px: dos columnas, filtros a la izquierda del principal", () => {
    const a = areas(valor(".pagina", "grid-template-areas", desde(BP_MD)));
    if (!a) return "No hay grid-template-areas dentro de @include desde($bp-md)";
    if (a.some((f) => f.length !== 2)) return "Cada fila del mapa de tablet debe tener 2 palabras";
    const fila = a.find((f) => f.includes("principal"));
    if (!fila || fila[0] !== "filtros" || fila[1] !== "principal") return "La fila del medio debe ser «filtros principal»";
    if (!valor(".pagina", "grid-template-columns", desde(BP_MD))) return "Falta grid-template-columns (15rem para los filtros y el resto)";
    return true;
  }],
  ["1", "Cada hijo tiene su grid-area con un nombre del mapa", () => {
    const nombres = new Set((areas(valor(".pagina", "grid-template-areas")) ?? []).flat());
    const mal = Object.entries(HIJOS).filter(([sel]) => {
      const v = valor(sel, "grid-area", () => true);
      return !v || !nombres.has(v);
    });
    return mal.length === 0 || `Sin grid-area válida: ${mal.map(([s]) => s).join(", ")}`;
  }],

  // 2 · catálogo
  ["2", ".catalogo es un grid", () => valor(".catalogo", "display") === "grid" || "Falta display: grid en .catalogo"],
  ["2", "Columnas automáticas: repeat(auto-fit o auto-fill, minmax(…))", () =>
    /repeat\(\s*auto-(fit|fill)\s*,\s*minmax\(/.test(valor(".catalogo", "grid-template-columns") ?? "") ||
    "grid-template-columns debe ser repeat(auto-fit, minmax(…, 1fr))"],
  ["2", "El mínimo de cada columna es 16rem (o min(16rem, 100%))", () =>
    /minmax\(\s*(min\(\s*16rem\s*,\s*100%\s*\)|16rem)\s*,/.test(valor(".catalogo", "grid-template-columns") ?? "") || "El mínimo de minmax debe ser 16rem"],
  ["2", "Hueco entre tarjetas con gap", () => !!valor(".catalogo", "gap") || "Falta gap en .catalogo"],
  ["2", "_catalogo.scss no usa media queries", () => {
    if (valor(".catalogo", "display") !== "grid") return "Primero haz la rejilla";
    const f = sinComentarios(fuentes["scss/components/_catalogo.scss"] ?? "");
    return !/@media|@include\s+desde/.test(f) || "Quita la media query: auto-fit ya decide cuántas columnas caben";
  }],

  // 3 · tarjeta
  ["3", "3a · .tarjeta es flex en columna", () =>
    (valor(".tarjeta", "display") === "flex" && valor(".tarjeta", "flex-direction") === "column") || "A .tarjeta le falta display: flex y flex-direction: column"],
  ["3", "3a · El cuerpo es flex en columna y crece", () => {
    const ok = valor(".tarjeta__cuerpo", "display") === "flex" && valor(".tarjeta__cuerpo", "flex-direction") === "column";
    const crece = /^1\b/.test(valor(".tarjeta__cuerpo", "flex") ?? "") || valor(".tarjeta__cuerpo", "flex-grow") === "1";
    return (ok && crece) || (!ok ? "A .tarjeta__cuerpo le falta flex en columna" : "A .tarjeta__cuerpo le falta flex: 1");
  }],
  ["3", "3a · El botón siempre al fondo (margin-top: auto)", () =>
    valor(".tarjeta__boton", "margin-top") === "auto" || /^auto\b/.test(valor(".tarjeta__boton", "margin-block-start") ?? "") || "Falta margin-top: auto en .tarjeta__boton"],
  ["3", "3b · .destacado es el contenedor (container-type: inline-size)", () => {
    if (valor(".tarjeta", "container-type", () => true)) return "El contenedor no puede ser la propia .tarjeta: ponlo en su padre, .destacado";
    return valor(".destacado", "container-type", () => true) === "inline-size" || "Falta container-type: inline-size en .destacado";
  }],
  ["3", "3b · @container (min-width: 32rem) pone la tarjeta en fila", () => {
    const r = reglas.filter((x) => esContainer(x) && x.selectores.includes(".tarjeta"));
    if (!r.length) return "No hay ninguna @container con .tarjeta dentro";
    const enSuMedida = r.filter((x) => x.ctx.some((a) => a.nombre === "container" && enPx(minWidth(a)) === 512));
    if (!enSuMedida.length) return "La container query debe ser (min-width: 32rem)";
    return enSuMedida.some((x) => x.decls.some((d) => d.prop === "flex-direction" && d.valor === "row")) || "Dentro de la @container, .tarjeta necesita flex-direction: row";
  }],
  ["3", "3b · En fila, la imagen ocupa el 40 %", () => {
    const r = reglas.filter((x) => esContainer(x) && x.selectores.includes(".tarjeta__imagen"));
    return r.some((x) => x.decls.some((d) => /^(flex-basis|width|flex)$/.test(d.prop) && /40%/.test(d.valor))) || "Dentro de la @container, .tarjeta__imagen debe medir el 40 % (flex-basis o width)";
  }],

  // 4 · segundo breakpoint y clamp
  ["4", "4a · Desde 1000px la página se centra con un máximo de 75rem", () => {
    const max = valor(".pagina", "max-width", desde(BP_LG)) ?? valor(".pagina", "max-width");
    const centrada = valor(".pagina", "margin-inline", () => true) === "auto" || /^(0|auto)?\s*auto$|^\S+\s+auto/.test(valor(".pagina", "margin", () => true) ?? "");
    return (max === "75rem" && centrada) || (max !== "75rem" ? "Falta max-width: 75rem en .pagina" : "Falta centrarla: margin-inline: auto");
  }],
  ["4", "4a · Desde 1000px los filtros miden 18rem", () =>
    /^18rem\b/.test(valor(".pagina", "grid-template-columns", desde(BP_LG)) ?? "") || "Dentro de @include desde($bp-lg), grid-template-columns de .pagina debe empezar por 18rem"],
  ["4", "4b · El título usa clamp(1.5rem, 1rem + 3vw, 2.75rem)", () => {
    const v = (valor(".principal__titulo", "font-size") ?? "").replace(/\s+/g, " ");
    if (!v.startsWith("clamp(")) return "El font-size de .principal__titulo debe ser un clamp(…)";
    return /^clamp\(1\.5rem, ?1rem \+ 3vw, ?2\.75rem\)$/.test(v) || `Tienes ${v}: revisa los tres valores`;
  }],

  // G · reglas generales (todo el proyecto)
  ["G", "Mobile-first: ninguna media query con max-width", () =>
    !/@media[^{]*max-width/.test(css) || "Hay una @media con max-width: en mobile-first solo se usa min-width"],
  ["G", "Los dos breakpoints salen de las variables ($bp-md y $bp-lg)", () => {
    const bps = new Set(reglas.flatMap((r) => r.ctx.filter((a) => a.nombre === "media").map((a) => enPx(minWidth(a)))));
    const raros = [...bps].filter((b) => b !== BP_MD && b !== BP_LG);
    return raros.length === 0 || `Hay breakpoints escritos a mano: ${raros.join(", ")}px. Usa $bp-md y $bp-lg`;
  }],
  ["G", "Sin !important", () => !/!important/.test(css) || "Quita el !important: mira en DevTools qué regla gana y por qué"],
  ["G", "Sin selectores de id (#…)", () =>
    !reglas.some((r) => r.selectores.some((s) => /#[\w-]/.test(s))) || "Hay un selector con #id: usa clases"],
  ["G", "Los colores solo se escriben en _tokens.scss", () => {
    const malos = Object.entries(fuentes).filter(([f, t]) => !f.endsWith("_tokens.scss") && /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(sinComentarios(t)));
    return malos.length === 0 || `Hay colores escritos a mano en: ${malos.map(([f]) => f).join(", ")}`;
  }],
  ["G", "Sin anchos fijos en px (width / min-width)", () => {
    const malos = reglas.filter((r) => r.decls.some((d) => /^(min-)?width$/.test(d.prop) && /\d+px/.test(d.valor)));
    return malos.length === 0 || `Ancho fijo en: ${malos.map((r) => r.selectores.join(", ")).join(" · ")} (romperá la prueba del acordeón)`;
  }],
];

// ───────────── ejecutar y mostrar ─────────────
if (errorCompilar && !JSON_OUT) {
  console.log(`\n${c(31, "✘ Tu SCSS no compila.")} Arregla esto primero (Sass te dice el fichero y la línea):\n`);
  console.log(c(33, errorCompilar));
  console.log("\nPista: suele ser un ; o una } que falta justo antes de la línea que dice.\n");
  process.exit(1);
}
const NOMBRES = { 0: "👀 0 · Lo que ya está hecho (si sale en rojo, has roto algo)", 1: "✍️ 1 · El esqueleto de la página con Grid", 2: "✍️ 2 · La rejilla del catálogo", 3: "✍️ 3 · La tarjeta y la container query", 4: "✍️ 4 · Segundo breakpoint y clamp()", G: "G · Buenas costumbres (todo el proyecto)" };
const resultados = PRUEBAS.map(([bloque, texto, fn]) => {
  let r;
  try {
    r = errorCompilar && bloque !== "0" ? "No se puede comprobar: el SCSS no compila" : fn();
  } catch (e) {
    r = `Error del comprobador: ${e.message}`;
  }
  return { bloque, texto, ok: r === true, detalle: r === true ? "" : r };
});

const vistos = resultados.filter((r) => !SOLO || r.bloque === SOLO || r.bloque === "0");
const verdes = resultados.filter((r) => r.ok).length;

if (JSON_OUT) {
  console.log(JSON.stringify({ verdes, total: resultados.length, resultados }, null, 1));
} else {
  let actual = null;
  for (const r of vistos) {
    if (r.bloque !== actual) {
      actual = r.bloque;
      console.log(`\n${c(1, NOMBRES[actual])}`);
    }
    console.log(`  ${r.ok ? c(32, "✔") : c(31, "✘")} ${r.texto}`);
    if (!r.ok) console.log(`      ${c(33, r.detalle.replace(/\n/g, "\n      "))}`);
  }
  const v = vistos.filter((r) => r.ok).length;
  console.log(`\n${c(1, `${v} de ${vistos.length}`)} en verde` + (SOLO ? ` (bloque ${SOLO})` : "") +
    (v === vistos.length ? c(32, " · ¡todo bien!") : ""));
  if (!SOLO && v === vistos.length) console.log("Ahora, la prueba del acordeón: de 1440 a 320 px, despacio, sin scroll horizontal. Y contesta respuestas.md.");
  console.log("");
}
