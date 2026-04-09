# Carga Masiva de Gastos desde PDF

## Objetivo

Permitir que el usuario cargue estados de cuenta en PDF de tarjetas y cuentas para que Ground:

1. extraiga movimientos,
2. proponga un mapeo a categorías y descripciones,
3. permita revisar, editar, aceptar o ignorar filas,
4. y recién entonces cree gastos reales del mes.

## Dónde debería vivir

La funcionalidad debe vivir dentro de `Gastos`, no en `Admin`.

Motivos:

- el usuario la percibe como otra forma de cargar gastos del mes;
- el flujo termina en gastos reales, no en configuración;
- `Gastos` ya tiene el contexto de mes, revisión, confirmación y edición;
- evita sumar otra entrada de navegación prematuramente.

Ubicación propuesta:

- CTA en `Gastos`: `Carga masiva`
- pantalla dedicada: `/app/expenses/import?year=YYYY&month=M`

## Principios del flujo

1. No importar automáticamente a gastos reales sin revisión.
2. PDF desde el MVP, pero solo para PDFs digitales con texto seleccionable.
3. Parsers específicos por banco y formato, no parser universal.
4. Parsing local en frontend siempre que sea posible.
5. El usuario revisa primero; Ground crea gastos recién al confirmar.

## Alcance MVP

### Entradas

- PDF de tarjeta de crédito
- PDF de cuenta corriente

### Prioridad realista

Fase 1:

- tarjetas de crédito primero

Fase 2:

- cuenta corriente

Motivo:

- los PDFs de tarjeta suelen ser más estables;
- los movimientos de cuenta mezclan consumos, transferencias, retiros, pagos de tarjeta, sueldo y comisiones.

## Flujo de usuario

### Paso 1. Subir PDF

El usuario entra a `Gastos > Carga masiva` y sube uno o varios PDFs.

### Paso 2. Detección

Ground detecta:

- banco o emisor
- tipo de documento
- período
- moneda
- si el formato está soportado

### Paso 3. Extracción

Cada parser convierte el PDF en movimientos normalizados:

- fecha
- descripción cruda
- monto
- moneda
- metadata útil (`installmentHint`, `cardLast4`, `sourceType`)

### Paso 4. Sugerencia

Ground propone para cada fila:

- categoría
- tipo (`FIXED` o `VARIABLE`)
- descripción sugerida
- score de confianza
- posible duplicado

### Paso 5. Revisión

El usuario puede:

- aceptar
- editar
- ignorar
- aceptar todos los de alta confianza

### Paso 6. Importación

Ground crea los `Expense` reales del mes en batch.

## Estrategia de matching

Orden recomendado:

1. Reglas aprendidas del usuario
2. Match contra `ExpenseTemplate`
3. Match contra gastos históricos confirmados
4. Reglas de exclusión
5. Detección de duplicados

## Reglas de exclusión mínimas

Hay que detectar y proponer como `ignorar`:

- pago de tarjeta
- saldo anterior
- pago mínimo
- transferencias internas
- retiro de efectivo
- comisiones bancarias
- ajustes, reversos o anulaciones

## Estrategia PDF

### Recomendación

Usar `pdfjs-dist` en frontend para extraer texto y coordenadas.

No basarse solo en texto corrido. Cada parser debe trabajar con:

- páginas
- bloques de texto
- posiciones `x/y`
- agrupación por filas y columnas

### Diseño recomendado

Cada banco o formato debería implementar:

- `canParse(pdf): boolean`
- `parse(pdf): NormalizedImportRow[]`

Ejemplos:

- `itauCreditCardParser`
- `santanderCreditCardParser`
- `brouCreditCardParser`

## Privacidad y E2EE

La recomendación es:

- parsear el PDF en el navegador;
- no subir el PDF crudo al backend;
- enviar al backend solamente las filas aprobadas por el usuario.

Esto alinea la funcionalidad con la promesa de Ground:

- el documento bancario completo no queda persistido del lado servidor;
- y los gastos creados pueden seguir usando el esquema E2EE actual.

## Modelo de datos propuesto

### `ExpenseImportSession`

- `id`
- `userId`
- `year`
- `month`
- `sourceKind`
- `providerKey`
- `status`
- `createdAt`
- `updatedAt`

### `ExpenseImportRow`

- `id`
- `sessionId`
- `date`
- `merchantRaw`
- `merchantNormalized`
- `amount`
- `amountUsd`
- `currencyId`
- `suggestedCategoryId`
- `finalCategoryId`
- `suggestedDescription`
- `finalDescription`
- `suggestedExpenseType`
- `finalExpenseType`
- `confidenceScore`
- `status`
- `duplicateOfExpenseId`
- `metadata`

### `MerchantMappingRule`

- `id`
- `userId`
- `merchantNormalized`
- `categoryId`
- `expenseType`
- `description`
- `templateId`
- `confidenceWeight`
- `lastUsedAt`
- `useCount`

## Próximo corte recomendado

1. Ruta y pantalla inicial dentro de `Gastos`
2. Parser PDF local para el primer banco de tarjeta
3. Tabla de revisión con aceptar, editar e ignorar
4. Commit batch a `Expense`
