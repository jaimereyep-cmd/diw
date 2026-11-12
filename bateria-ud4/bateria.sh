#!/usr/bin/env bash
#
# bateria.sh — Batería de ejercicios de la UD4 de DIW (opcional, no cuenta para nota).
#   ./bateria.sh ayuda
#
set -uo pipefail
cd "$(dirname "$0")"
IMAGEN=node:22-alpine

if [ -t 1 ]; then R=$'\e[1;31m'; V=$'\e[1;32m'; N=$'\e[1m'; X=$'\e[0m'; else R=""; V=""; N=""; X=""; fi

# Node, Vite y Sass van en Docker: en tu ordenador no se instala nada más
con_docker() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }
ejecutar() {
    if con_docker; then
        docker run --rm -i -e TZ=Europe/Madrid -e FORCE_COLOR="${FORCE_COLOR:-$([ -t 1 ] && echo 1 || echo 0)}" \
            -e npm_config_cache=/tmp/.npm -u "$(id -u):$(id -g)" -v "$PWD":/app -w /app "$IMAGEN" "$@"
    else
        echo "${R}✘ No encuentro Docker (o no está arrancado).${X} Arráncalo como en la práctica 1: todo va dentro de Docker." >&2
        exit 1
    fi
}

# Vite y Sass se descargan una vez, en node_modules/
preparar() {
    echo "Descargando Vite y Sass (solo la primera vez)…"
    ejecutar npm install --no-audit --no-fund --loglevel=error --update-notifier=false || { echo "${R}✘ No he podido descargar las dependencias. ¿Tienes internet?${X}"; exit 1; }
    echo "${V}✔ Listo${X}"
}

ayuda() {
    cat <<AYUDA
${N}Batería de ejercicios · DIW UD4 (layout responsive)${X} — opcional, para practicar antes del bloque A de la práctica

  ./bateria.sh ver                abre la página en http://localhost:5173 (Ctrl+C para pararla)
  ./bateria.sh comprobar          todos los bloques: qué llevas bien y qué te falta
  ./bateria.sh comprobar 3        solo el bloque 3
  ./bateria.sh preparar           descarga Vite y Sass (lo hace solo la primera vez)

  Los ejercicios están en scss/components/. La explicación de cada bloque, en la web de DIW:
  Practicar → UD4 · Layout responsive. Al acabar, contesta respuestas.md.
AYUDA
}

case "${1:-ayuda}" in
    comprobar)
        shift
        [ -d node_modules/sass ] || preparar
        ejecutar node comprobador/comprobar.mjs "$@" ;;
    ver)
        [ -d node_modules/vite ] || preparar
        con_docker || ejecutar true
        echo "Abre ${N}http://localhost:5173${X} en el navegador. Para pararla: Ctrl+C"
        UID_GID="$(id -u):$(id -g)" docker compose up ;;
    preparar) preparar ;;
    ayuda|-h|--help) ayuda ;;
    *) echo "${R}No conozco «$1».${X}"; ayuda; exit 1 ;;
esac
