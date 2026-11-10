# Lista de la compra 🛒

PWA minimalista para la compra del súper. Sin servidor propio, sin cuentas, sin precios. Sincronización opcional con Firebase mediante una clave compartida.

## Cómo se usa

1. **Catálogo** — escribe o busca un producto. Toca una fila para añadirlo a la lista (o quitarlo). Si no existe, usa la fila «Crear … y añadir a la lista».
2. **Tu lista** — pestaña *Comprar*. La lista persiste entre días.
3. Cuando vayas al súper, pulsa **Iniciar compra**. Marca cada producto al meterlo en el carrito.
4. **Finalizar compra** — los productos marcados se dan por comprados y salen de la lista; los que no marcaste **siguen en la lista** para la siguiente visita al súper (p. ej. otro centro).
5. Puedes añadir productos desde el catálogo también **durante** una compra en curso; aparecerán como pendientes.

## Cómo se instala

### iPhone / iPad (Safari)
1. Abre la app en Safari.
2. Pulsa el botón de **Compartir** (cuadrado con flecha arriba).
3. Elige **Añadir a pantalla de inicio**.
4. Aparecerá un icono "Compra" en tu móvil. Ábrelo desde ahí.

### Android (Chrome)
1. Abre la app en Chrome.
2. Menú ⋮ → **Instalar aplicación** (o "Añadir a pantalla de inicio").
3. Aparece como app normal en el cajón.

### Sin instalar
Funciona también entrando a la URL desde cualquier navegador.

## Funciones

- **Exportar** (Ajustes): descarga un JSON con catálogo y lista.
- **Borrar todo** (Ajustes): resetea la lista compartida en Firebase.
- **Funciona sin internet** después de la primera visita (Service Worker).

## Privacidad

- Con Firebase: los datos viven bajo una clave que solo conocéis quienes la compartís. Sin emails ni cuentas.
- Sin conexión: la app puede seguir en modo local en el dispositivo.
