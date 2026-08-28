# Prompt 18: Rollback del Modificador de Precio y Reseteo de Capital (Hard Math)

Actúa como Lead Quant Developer. El `PriceActionEngine` está generando falsos positivos al inflar artificialmente la probabilidad con el `scoreModifier` (+15 puntos), induciendo entradas prematuras en medio de caídas agresivas. Además, al estar en fase de pruebas, necesitamos restaurar el capital inicial.

Ejecuta inmediatamente las siguientes modificaciones:

**1. Neutralización Matemática (`bot/simulator.js`):**
- Mantén la ejecución de `PriceActionEngine.analyzePatterns` para no perder la visibilidad en los logs.
- Dentro de `calculateEntryProbability`, elimina o comenta estrictamente las líneas donde sumas o restas el `paData.scoreModifier` al score final.
- El `realScore` debe volver a ser un reflejo exclusivo de la matemática pura original: RSI (60% de peso) y Bollinger (40% de peso). El nombre del patrón debe pasarse al log de forma informativa, pero jamás alterar la probabilidad.

**2. Reseteo de Capital (`bot/db.js` y `bot/state.js`):**
- Crea un script rápido o modifica temporalmente el inicio para hacer un `UPDATE` en la tabla `bot_state` fijando el `virtual_balance` de nuevo en `100.00` para el registro principal.
- Asegúrate de que el estado en memoria (`state.virtualBalance`) y los Slots (`slot0` y `slot1`) se reinicien con este nuevo balance de 100 USDT.
- Limpia cualquier cooldown activo que haya quedado pegado en memoria.

Inyecta estas correcciones y confírmame cuando el sistema esté operando únicamente con la probabilidad base y el balance restaurado.