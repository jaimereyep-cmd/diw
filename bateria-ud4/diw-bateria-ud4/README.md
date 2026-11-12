# Batería de ejercicios · DIW UD4 — el catálogo de RAÍZ

Opcional: **no se entrega y no cuenta para la nota**. La explicación de cada bloque está en la web de DIW,
en «🏋️ Practicar → UD4 · Layout responsive».

Necesitas **Docker**. En tu ordenador no se instala nada más.

```bash
chmod +x bateria.sh
./bateria.sh comprobar      # la primera vez descarga Vite y Sass; al principio solo está en verde lo 👀
./bateria.sh ver            # la página en http://localhost:5173 (en otra terminal)
code .
```

- Los ejercicios están en `scss/components/`: `_cabecera.scss` es el 👀 ejemplo, y en `_layout.scss`,
  `_catalogo.scss` y `_tarjeta.scss` están los ✍️ huecos (busca `✍️`), con pistas.
- **El HTML no se toca**: todo se resuelve en `scss/`.
- Al acabar, la prueba del acordeón (de 1440 a 320 px, sin scroll horizontal) y `respuestas.md`.
