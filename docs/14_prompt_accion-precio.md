# Prompt 14: Módulo de Acción del Precio (PriceActionEngine) y Meta-Labeling

Actúa como Arquitecto de Sistemas HFT. Necesitamos implementar el módulo de "Acción del Precio" validado por nuestro modelo cuantitativo para confirmar las entradas y reducir los Stop Loss prematuros por "cuchillos cayendo".

Modifica los archivos del bot de la siguiente manera:

**1. Creación del Archivo `bot/PriceActionEngine.js`:**
Crea este nuevo archivo en el directorio `bot`. Debe contener la clase estática y los métodos analíticos vectorizados exactos provistos en la documentación para extraer métricas de velas (range, body, wicks, filling, ibs) y detectar: DOJI, BULLISH_ENGULFING, BULLISH_HARAMI, HAMMER y SHOOTING_STAR. Exporta el módulo.

**2. Actualización de `bot/simulator.js` (o donde proceses las velas):**
- Importa el nuevo módulo: `const PriceActionEngine = require('./PriceActionEngine');`
- En el flujo principal, una vez obtengas el array de las últimas velas de 1m desde Binance (`marketData`), pásalo por el analizador:
  `const paData = PriceActionEngine.analyzePatterns(marketData);`

**3. Actualización del Scoring (`calculateEntryProbability`):**
- Pasa el objeto `paData` a la función que calcula la probabilidad.
- Añade el "Modificador de Fuerza Asimétrico":
  - Para `LONG`: Si `paData.direction === 1`, suma `paData.scoreModifier` al score base final. Si es `-1` (contradicción), resta el modifier.
  - Para `SHORT`: Si `paData.direction === -1`, suma `paData.scoreModifier`. Si es `1`, resta.
- Asegúrate de capar la probabilidad máxima al 99% para que no sobrepase el umbral visual de 100%.

**4. Logs y Eventos (SSE):**
- Si se ejecuta un trade y hubo un patrón que empujó el score por encima de 90%, emite en el log: `[ACCIÓN DE PRECIO] Gatillo de francotirador activado por patrón: ${paData.pattern}`.

Procede a crear el archivo y hacer las modificaciones sin alterar la base de datos o el frontend de visualización. Avísame apenas termines.