# Prompt 16: Sistema de Cooldown (Enfriamiento) Anti-Ametrallamiento

Actúa como Quant Developer. He notado en los logs que el bot sufre de "machine-gunning" durante cascadas bajistas: toca un Stop Loss y, como los indicadores siguen en sobreventa extrema (RSI < 20), vuelve a abrir una posición en el siguiente tick, encadenando múltiples Stop Losses seguidos en la misma moneda.

Necesitamos implementar un sistema de Cooldown en el motor Dual-Slot.

Modifica `bot/state.js` y `bot/simulator.js` con las siguientes reglas:
1. **Nuevo Estado:** En `state.js`, crea un diccionario `cooldowns = {}` (llave: símbolo, valor: timestamp de liberación).
2. **Aplicar Castigo:** En `simulator.js`, dentro de la lógica de venta (`executeSell`), SI y SOLO SI la razón de salida es `STOP LOSS`, asigna un cooldown a esa moneda de 15 minutos en el futuro: 
   `state.cooldowns[symbol] = Date.now() + (15 * 60 * 1000);`
3. **Bloqueo de Entrada:** En la función principal donde decides abrir un trade (o dentro de `calculateEntryProbability`), verifica si el símbolo actual está en cooldown (`Date.now() < state.cooldowns[symbol]`). Si es así, fuerza el score a 0% o descártalo de los candidatos, ignorando completamente los indicadores.
4. **Log de SSE:** Opcional: si la moneda da señal pero está en cooldown, no emitas alerta, simplemente ignórala silenciosamente para no saturar el panel.

Inyecta este código inmediatamente para detener el "overtrading" en caídas fuertes.