# Prompt 12/13: Apalancamiento 10x y Margen Asimétrico (Futures V3.0)

Actúa como Quant Developer. Necesitamos implementar apalancamiento en Binance Futures y el modelo de gestión "Asymmetric Equity-Dependent Position Sizing". Mantén intacta la persistencia (DB) y los eventos del frontend (SSE).

Modifica `bot/state.js` y `bot/simulator.js` con estas reglas:

**1. Actualización de Estado (`state.js`):**
- Añade: `LEVERAGE: 10`, `FUTURE_FEE_RATE: 0.001`, `TARGET_ROE_TP: 0.20`, `TARGET_ROE_SL: -0.10`.
- Actualiza `SLOTS_CAPITAL` para que cada slot incluya `allocatedMargin` y `feeIn`.

**2. Margen Asimétrico y Apalancamiento (`executeBuy` en `simulator.js`):**
- Crea e implementa la regla de margen asimétrico: 
  Si `state.virtualBalance > 100.0`, el margen a invertir es el 50% del balance.
  Si `state.virtualBalance <= 100.0`, el margen a invertir es estrictamente 50.0. 
  (Aplica control para asegurar que el margen nunca supere el balance real disponible).
- Tamaño nominal apalancado: `nominalSize = margen * state.LEVERAGE`.
- Calcula la comisión inicial: `feeIn = nominalSize * FUTURE_FEE_RATE`.
- El capital que realmente entra al juego (para calcular quantity) es el nominalSize.
- Calcula los TP y SL dinámicos con las fórmulas de ROE neto (con L=10 y f=0.001):
  - LONG TP = P_entry * ((TARGET_ROE_TP + 1.0) / (L * (1-f)^2))
  - LONG SL = P_entry * ((TARGET_ROE_SL + 1.0) / (L * (1-f)^2))
  - SHORT TP = P_entry * ((2.0 - (TARGET_ROE_TP + 1.0)/(1-f)) / (1+f))
  - SHORT SL = P_entry * ((2.0 - (TARGET_ROE_SL + 1.0)/(1-f)) / (1+f))
- Guarda en el slot activo el `nominalSize`, el `margen` inicial y el `feeIn`.

**3. Cierre y PNL Neto (`executeSell` en `simulator.js`):**
- PNL Bruto = (diferencia de precios) * quantity apalancada.
- `feeOut = (quantity * precioSalida) * FUTURE_FEE_RATE`.
- PNL Neto = PNL Bruto - feeIn - feeOut.
- Suma el PNL Neto al `state.virtualBalance`.
- **CRÍTICO:** Mantén intactas las llamadas a `db.saveTrade()`, `db.updateBalance()` y `state.emit('trade_closed')`.