# Sea Battle

Juego de batalla naval 1v1 con Next.js 16 y Firebase. El navegador envía intenciones; Cloud Functions valida y calcula todo resultado, mientras Firestore conserva el estado público y los tableros secretos quedan aislados por reglas.

## Incluido

- autenticación anónima y recuperación de partida activa;
- salas de seis caracteres para dos jugadores;
- tablero 10×10 y flota clásica sin barcos adyacentes;
- colocación manual, drag & drop, rotación y auto-colocación;
- ataques `MISS`, `HIT`, `SUNK`, victoria y estadísticas;
- turnos de 30 segundos con tareas de Cloud Tasks y protección contra tareas obsoletas;
- idempotencia por `actionId`, transacciones y límite de 15 acciones sensibles por segundo;
- listeners compactos, historial reciente y reloj ajustado a hora de servidor;
- presencia RTDB, reconexión y abandono tras cinco minutos desconectado;
- revancha con un `gameId` nuevo y el mismo `seriesId`;
- reglas que impiden al cliente leer tableros secretos o escribir estado autoritativo;
- interfaz responsive, accesible y con confirmación separada del disparo en móvil.

El arsenal avanzado conserva tipos, inventario y fronteras privadas en el modelo, pero no está habilitado: el plan deja sin definir costos y reglas deterministas de varias armas. No se inventaron reglas competitivas. `nuclear` permanece fuera del MVP según la especificación.

## Desarrollo local

Requisitos: Node.js 22, Java 17+ y Firebase CLI.

1. Copia `apps/web/.env.local.example` a `apps/web/.env.local`.
2. Ejecuta `npm install`.
3. Ejecuta `npm run dev`.
4. Abre `http://localhost:3000` en dos perfiles o ventanas privadas.

Los emuladores usan el proyecto seguro `demo-sea-battle`; no acceden a recursos reales.

## Verificación

```bash
npm test
npm run typecheck
npm run lint
npm run build
firebase emulators:exec --only firestore --project demo-sea-battle "npm test -- functions/src/security/firestore.rules.test.ts"
```

## Configuración Firebase real

1. Crea o selecciona el proyecto y reemplaza `demo-sea-battle` en `.firebaserc`.
2. Activa Authentication → Anonymous, Firestore y Realtime Database.
3. Habilita facturación Blaze y las APIs Cloud Functions, Cloud Build, Artifact Registry, Cloud Scheduler y Cloud Tasks.
4. Completa las variables `NEXT_PUBLIC_FIREBASE_*` en Vercel.
5. Despliega backend y reglas con `firebase deploy --only functions,firestore:rules,firestore:indexes,database`.
6. Construye/despliega `apps/web` en Vercel con el directorio raíz del repositorio y el workspace `@sea-battle/web`.

La cola creada por la función task queue requiere que Firebase pueda otorgar al agente de servicio los permisos de invocación indicados durante el primer despliegue.

## Estructura

- `apps/web`: Next.js, UI, estado visual y adaptadores Firebase.
- `functions`: callables, transacciones, timeout, presencia y rate limit.
- `packages/game-engine`: reglas puras y comprobables.
- `packages/shared-types`: contratos y esquemas Zod.
- `firestore.rules` / `database.rules.json`: frontera de confianza.

## Alcance futuro

Los contratos para radar, minas, submarino, antiaérea y aviación están tipados, pero deben activarse solo después de fijar en una especificación sus costos, probabilidades, patrones y efectos sobre el turno. Cuentas permanentes, ranking y matchmaking corresponden a la Fase 4 del documento y requieren decisiones de producto adicionales.
