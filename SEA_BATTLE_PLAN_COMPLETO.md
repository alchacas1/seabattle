# Sea Battle Web Multiplayer — Plan Completo de Implementación

## 1. Objetivo del proyecto

Crear un juego web multijugador de **Sea Battle / Batalla Naval** para dos jugadores, con partidas en tiempo real mediante código de sala.

El sistema debe incluir:

- Tablero de **10×10**.
- Dos jugadores por partida.
- Código de sala.
- Colocación manual y automática de barcos.
- Ataques por turnos.
- **30 segundos por turno**.
- Cambio automático de turno cuando se acaba el tiempo.
- Persistencia de partida.
- Recuperación después de:
  - pérdida de Internet,
  - recarga de página,
  - cierre accidental del navegador,
  - reconexión.
- Sincronización en tiempo real.
- Lógica crítica ejecutada del lado servidor.
- Protección contra trampas.
- Arquitectura preparada para agregar:
  - radar,
  - minas,
  - submarino,
  - batería antiaérea,
  - caza,
  - avión de ataque,
  - torpedero,
  - escuadrón de torpederos,
  - bombardero,
  - arma nuclear,
  - otras habilidades.

---

# 2. Stack recomendado

## Frontend

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Zustand opcional para estado visual
- Zod para validación

## Backend / servicios

- Firebase Authentication
- Cloud Firestore
- Firebase Realtime Database
- Cloud Functions v2
- Google Cloud Tasks

## Hosting

Opción principal:

- Frontend: Vercel
- Backend Firebase: Google Cloud / Firebase

También puede usarse Firebase Hosting si se desea alojar todo dentro del ecosistema Firebase.

---

# 3. Arquitectura general

```text
Jugador A
    │
    │
    ▼
Next.js / React
    │
    ├──────────── Firebase Authentication
    │
    ├──────────── Firestore
    │                  │
    │                  ├─ partidas
    │                  ├─ estado público
    │                  ├─ historial
    │                  └─ ataques
    │
    ├──────────── Realtime Database
    │                  │
    │                  └─ presencia / conexión
    │
    └──────────── Cloud Functions v2
                       │
                       ├─ crear sala
                       ├─ unirse
                       ├─ colocar barcos
                       ├─ confirmar flota
                       ├─ atacar
                       ├─ usar armas
                       ├─ cambiar turno
                       ├─ finalizar partida
                       └─ reconectar

Cloud Functions
      │
      └────────── Google Cloud Tasks
                         │
                         └─ timeout de 30 segundos
```

---

# 4. Principio principal de seguridad

El cliente nunca debe ser la autoridad de la partida.

El navegador solo puede:

- mostrar información,
- seleccionar casillas,
- enviar intenciones,
- recibir resultados.

El servidor debe decidir:

- si es el turno correcto,
- si la coordenada es válida,
- si un ataque acierta,
- si un barco se hunde,
- si alguien gana,
- si el tiempo terminó,
- si un arma puede usarse,
- qué zonas revela un radar,
- dónde caen bombas aleatorias,
- si una mina se activa,
- si una defensa antiaérea derriba un avión.

Regla principal:

```text
CLIENTE SOLICITA
SERVIDOR VALIDA
SERVIDOR CALCULA
SERVIDOR GUARDA
CLIENTES RECIBEN
```

---

# 5. Firebase Authentication

## 5.1 Autenticación inicial

Para el MVP se recomienda usar:

```ts
signInAnonymously(auth)
```

Cada jugador tendrá un UID persistente.

Ejemplo:

```text
xNa7dP32kX...
```

Esto permite:

- reconectar a una partida,
- identificar al jugador,
- recuperar el estado,
- agregar cuentas reales después.

## 5.2 Futuro

Se puede permitir vincular una cuenta anónima con:

- Google,
- email + contraseña,
- otros proveedores.

Esto permitirá guardar:

- estadísticas,
- historial,
- victorias,
- derrotas,
- nivel,
- inventario,
- ranking.

---

# 6. Creación de sala

## Flujo

Jugador A pulsa:

```text
Crear partida
```

Cloud Function:

```text
createRoom()
```

Genera:

- ID interno de partida.
- Código público de sala.
- jugador 1.
- estado inicial.

Ejemplo:

```text
Código: K7F2QX
```

## Recomendación de códigos

Usar 6 caracteres:

```text
A-Z
2-9
```

Excluir caracteres confusos:

```text
0
O
1
I
L
```

---

# 7. Unión a sala

Jugador B escribe:

```text
K7F2QX
```

Function:

```text
joinRoom()
```

Debe validar:

- la sala existe,
- la partida permite unirse,
- solo hay un jugador,
- el usuario no es ya miembro de otra posición,
- la partida no ha comenzado.

Después:

```text
roomLocked = true
```

Un tercer usuario recibe:

```text
ROOM_FULL
```

---

# 8. Estados de partida

```ts
type GameStatus =
  | "WAITING_PLAYER"
  | "PLACING_SHIPS"
  | "READY"
  | "PLAYING"
  | "FINISHED"
  | "ABANDONED";
```

Flujo:

```text
WAITING_PLAYER
       ↓
PLACING_SHIPS
       ↓
READY
       ↓
PLAYING
       ↓
FINISHED
```

---

# 9. Tablero

Tamaño:

```text
10 columnas
10 filas
100 celdas
```

Coordenadas visibles:

```text
    1  2  3  4  5  6  7  8  9 10
 A  □  □  □  □  □  □  □  □  □  □
 B  □  □  □  □  □  □  □  □  □  □
 C  □  □  □  □  □  □  □  □  □  □
 D  □  □  □  □  □  □  □  □  □  □
 E  □  □  □  □  □  □  □  □  □  □
 F  □  □  □  □  □  □  □  □  □  □
 G  □  □  □  □  □  □  □  □  □  □
 H  □  □  □  □  □  □  □  □  □  □
 I  □  □  □  □  □  □  □  □  □  □
 J  □  □  □  □  □  □  □  □  □  □
```

Internamente:

```ts
{
  row: 0,
  col: 4
}
```

Mapeo:

```text
A = 0
B = 1
...
J = 9
```

---

# 10. Flota clásica recomendada

```text
1 barco de 4 celdas
2 barcos de 3 celdas
3 barcos de 2 celdas
4 barcos de 1 celda
```

Total:

```text
10 barcos
20 celdas ocupadas
```

Modelo:

```ts
type Ship = {
  id: string;
  size: number;
  orientation: "H" | "V";
  cells: Coordinate[];
  hits: Coordinate[];
  sunk: boolean;
};
```

---

# 11. Reglas de colocación

Validar en servidor:

- barco dentro del tablero,
- longitud correcta,
- sin superposición,
- cantidad correcta,
- orientación válida,
- no modificar flota después de confirmar.

Opcional:

- impedir que dos barcos se toquen,
- incluso diagonalmente.

Para replicar el estilo del juego de referencia, se recomienda no permitir barcos adyacentes.

---

# 12. Colocación automática

Agregar botón:

```text
Auto
```

El servidor o cliente puede generar una propuesta.

La validación final siempre debe hacerla el servidor.

Opciones:

```text
[ Auto ]
[ Reiniciar ]
[ Confirmar ]
```

---

# 13. Separación entre datos públicos y secretos

Este es uno de los puntos más importantes.

## Nunca enviar los barcos enemigos al navegador

No hacer:

```json
{
  "enemyShips": [...]
}
```

aunque se oculten con CSS.

Un usuario podría abrir DevTools y verlos.

---

# 14. Estructura recomendada en Firestore

```text
games/
  {gameId}/
      roomCode
      status
      player1Id
      player2Id
      currentTurnPlayerId
      turnNumber
      turnStartedAt
      turnEndsAt
      winnerId
      createdAt
      updatedAt

      players/
          {playerId}

      publicBoards/
          {playerId}

      attacks/
          {attackId}

      events/
          {eventId}
```

Los tableros secretos NO deben estar disponibles directamente para los clientes.

---

# 15. Tablero privado

Guardar los datos secretos en una colección con reglas que impidan lectura desde cliente.

Ejemplo conceptual:

```text
privateGameData/
  {gameId}/
      player1Board
      player2Board
      mines
      antiAir
      submarine
      specialState
```

Solo Cloud Functions con Admin SDK debe tener acceso.

Ejemplo:

```ts
{
  ships: [
    {
      id: "ship1",
      size: 4,
      cells: [
        { row: 2, col: 3 },
        { row: 2, col: 4 },
        { row: 2, col: 5 },
        { row: 2, col: 6 }
      ]
    }
  ]
}
```

---

# 16. Tablero público enemigo

El jugador solo ve:

```ts
{
  attacks: {
    "2-3": "HIT",
    "4-7": "MISS",
    "8-1": "SUNK"
  }
}
```

Nunca debe recibir:

- barcos intactos,
- minas ocultas,
- posición real del submarino,
- defensas antiaéreas ocultas,
- datos secretos de armas.

---

# 17. Ataque básico

Cliente:

```ts
const attack = httpsCallable(functions, "attack");

await attack({
  gameId,
  row: 4,
  col: 6,
  actionId: crypto.randomUUID()
});
```

Cloud Function debe validar:

```text
¿existe la partida?
¿está PLAYING?
¿el jugador pertenece?
¿es su turno?
¿quedan segundos?
¿coordenada válida?
¿ya fue atacada?
```

Después:

```text
leer tablero privado enemigo
↓
calcular resultado
↓
guardar
↓
emitir cambio por Firestore
```

---

# 18. Resultados posibles

```ts
type AttackResult =
  | "MISS"
  | "HIT"
  | "SUNK";
```

Ejemplo:

```ts
{
  row: 4,
  col: 2,
  result: "HIT",
  turnNumber: 13
}
```

Si hunde:

```ts
{
  result: "SUNK",
  sunkShipSize: 3
}
```

---

# 19. Cambio de turno

Debe definirse desde el inicio la regla.

## Opción A

Siempre cambia turno.

```text
disparo
↓
cambio de jugador
```

## Opción B

El jugador sigue si acierta.

```text
MISS → cambia turno
HIT → continúa
SUNK → continúa
```

Recomendación:

hacerlo configurable:

```ts
rules.keepTurnOnHit = true;
```

---

# 20. Temporizador de 30 segundos

El navegador no debe controlar el tiempo oficial.

Guardar:

```ts
turnStartedAt
turnEndsAt
```

Ejemplo:

```text
Inicio: 13:50:00
Fin:    13:50:30
```

El frontend solo muestra:

```text
30
29
28
...
```

---

# 21. Google Cloud Tasks para timeout

Cuando comienza un turno:

```text
turnNumber = 15
turnEndsAt = ahora + 30 segundos
```

Cloud Function programa una Cloud Task para ejecutarse a los 30 segundos.

Cuando llega:

```text
¿turnNumber sigue siendo 15?
```

Si sí:

```text
jugador no atacó
↓
cambiar turno
```

Si no:

```text
el turno ya cambió
↓
no hacer nada
```

Esto evita condiciones de carrera.

---

# 22. Identificador de turno

Además de `turnNumber`, puede usarse:

```ts
turnId: string
```

Ejemplo:

```text
turnId = "t_000015"
```

Cada Cloud Task debe verificar que sigue siendo el mismo turno.

---

# 23. Sincronización del reloj

No confiar exclusivamente en:

```js
Date.now()
```

del usuario.

El servidor puede proporcionar:

```ts
{
  serverTime,
  turnEndsAt
}
```

Frontend:

```ts
offset = serverTime - Date.now()
```

Luego:

```ts
remaining =
  turnEndsAt -
  (Date.now() + offset)
```

---

# 24. Firestore en tiempo real

Usar:

```ts
onSnapshot()
```

para escuchar cambios.

Ejemplos:

```text
game document
publicBoard propio
publicBoard enemigo
attacks
events recientes
```

Evitar escuchar colecciones innecesariamente grandes.

---

# 25. Reconexión

Si el jugador pierde Internet:

```text
no se borra la partida
no se pausa el servidor
el timer continúa
```

Cuando vuelve:

```text
Firebase Auth recupera UID
↓
se vuelve a conectar
↓
onSnapshot obtiene estado actual
↓
UI se reconstruye
```

---

# 26. Fuente de verdad

Regla:

```text
SERVER STATE WINS
```

Si React tenía:

```text
turno 12
```

pero Firestore dice:

```text
turno 13
```

se reemplaza el estado local.

Nunca intentar fusionar estados conflictivos.

---

# 27. Presencia con Realtime Database

Firestore no es lo mejor para saber inmediatamente si un usuario está conectado.

Usar:

```text
presence/{uid}
```

Ejemplo:

```ts
{
  online: true,
  lastSeen: ...
}
```

Usar:

```ts
onDisconnect()
```

para marcar:

```text
online = false
```

---

# 28. Estado visual de presencia

Mostrar:

```text
● Conectado
```

o:

```text
○ Reconectando...
```

o:

```text
● Desconectado
```

---

# 29. Qué pasa si un jugador pierde Internet

Ejemplo:

```text
Jugador A
quedan 18 segundos

Internet cae
```

El reloj continúa.

Si llega a 0:

```text
turno para jugador B
```

Cuando A vuelve:

```text
recibe snapshot actualizado
```

No se recomienda pausar automáticamente, porque alguien podría desconectar Internet para congelar su turno.

---

# 30. Tiempo máximo desconectado

Para partidas casuales:

```text
5 minutos
```

Opcional:

```text
Jugador desconectado
4:32 restantes para volver
```

Después:

```text
ABANDONED
```

o:

```text
victoria por abandono
```

---

# 31. Idempotencia

Cada acción debe llevar:

```ts
actionId
```

Ejemplo:

```ts
{
  actionId: crypto.randomUUID(),
  gameId,
  row,
  col
}
```

Guardar IDs de acciones procesadas.

Si el navegador reenvía una petición por mala conexión:

```text
mismo actionId
```

el servidor devuelve el resultado anterior y no procesa otra vez.

---

# 32. Condiciones de carrera

Evitar que dos llamadas modifiquen el mismo turno simultáneamente.

Usar:

- transacciones Firestore,
- validación de `turnNumber`,
- validación de `actionId`,
- validación de timestamps.

Ejemplo:

```text
leer game
↓
verificar turnNumber
↓
ejecutar ataque
↓
actualizar en transacción
```

---

# 33. Firestore Transactions

El ataque debe ejecutar una transacción para actualizar consistentemente:

- estado de partida,
- tablero público,
- turno,
- resultado,
- winnerId si corresponde.

---

# 34. Historial de eventos

Guardar:

```text
GAME_CREATED
PLAYER_JOINED
FLEET_CONFIRMED
GAME_STARTED
TURN_STARTED
ATTACK
SHIP_HIT
SHIP_SUNK
TURN_TIMEOUT
PLAYER_DISCONNECTED
PLAYER_RECONNECTED
WEAPON_USED
GAME_FINISHED
```

Ejemplo:

```json
{
  "type": "ATTACK",
  "playerId": "abc",
  "payload": {
    "row": 4,
    "col": 3,
    "result": "MISS"
  }
}
```

Esto ayuda con:

- debugging,
- replay,
- estadísticas,
- auditoría,
- recuperación.

---

# 35. Pantalla inicial

```text
SEA BATTLE

Nombre
[ Alvaro ]

[ Crear partida ]

Código de sala
[ K7F2QX ]

[ Unirse ]
```

---

# 36. Sala de espera

```text
Sala K7F2QX

Alvaro     ● Conectado
Anders     Esperando...

[ Copiar código ]
```

Cuando entra el segundo:

```text
Preparando partida...
```

---

# 37. Pantalla de colocación

Debe incluir:

- tablero propio,
- inventario de barcos,
- drag & drop,
- rotación,
- eliminación,
- Auto,
- Reiniciar,
- Confirmar.

Estado:

```text
Tu flota está lista
Esperando al rival...
```

---

# 38. Pantalla de batalla

Desktop:

```text
┌─────────────────────────────────────────────┐
│ Sala K7F2QX             Turno: Alvaro       │
│                        00:24                │
├─────────────────────┬───────────────────────┤
│ TU FLOTA            │ FLOTA ENEMIGA         │
│                     │                       │
│ tablero 10x10       │ tablero 10x10         │
│                     │                       │
├─────────────────────┴───────────────────────┤
│ Arsenal                                     │
├─────────────────────────────────────────────┤
│ Historial                                   │
│ Alvaro → E5: impacto                        │
│ Anders → C7: agua                           │
└─────────────────────────────────────────────┘
```

---

# 39. Diseño móvil

Priorizar el tablero enemigo.

```text
TURNO: ALVARO
00:18

TABLERO ENEMIGO

[10x10]

[ ATACAR E5 ]

[ Arsenal ]

[ Ver mi flota ]
```

---

# 40. Selección de ataque

Para evitar taps accidentales:

Primer toque:

```text
Seleccionado: E5
```

Después:

```text
[ ATACAR E5 ]
```

No disparar directamente al primer toque en móvil.

---

# 41. Estados visuales del tablero

```text
□ desconocido
● agua
✕ impacto
🔥 hundido
■ barco propio
▧ objetivo seleccionado
```

---

# 42. Timer visual

```text
████████████████░░░░
19 s
```

Opcional:

```text
30-11 segundos → normal
10-6           → alerta
5-0            → crítico
```

Se puede agregar sonido en últimos segundos.

---

# 43. Fin de partida

Cuando todos los barcos enemigos estén hundidos:

```text
VICTORIA
```

Mostrar:

- ganador,
- turnos,
- ataques,
- impactos,
- fallos,
- precisión,
- barcos hundidos,
- armas usadas.

Botones:

```text
[ Revancha ]
[ Salir ]
```

---

# 44. Revancha

Crear una nueva partida internamente.

No reutilizar el mismo `gameId`.

Se puede mantener:

```text
seriesId
```

Ejemplo:

```text
Alvaro 2 - 1 Anders
```

---

# 45. Arsenal

El arsenal se implementará después del Sea Battle clásico.

Arquitectura:

```ts
interface Weapon {
  validate(context: GameContext, target: unknown): Promise<void>;
  execute(context: GameContext, target: unknown): Promise<WeaponResult>;
}
```

Cada arma tendrá su propia lógica.

---

# 46. Arma: Caza

Según la referencia:

```text
zona 2×5
```

Seleccionar una zona válida.

Cloud Function calcula qué celdas son afectadas.

---

# 47. Arma: Avión de ataque

Zona principal:

```text
2×3
```

Además:

```text
2 misiles
```

sobre áreas adyacentes de:

```text
1×2
```

Servidor decide y valida el patrón.

---

# 48. Arma: Avión torpedero

Ataque en línea recta.

Puede afectar una fila o columna según las reglas definitivas.

---

# 49. Arma: Escuadrón de torpederos

Dos aviones.

Cada uno lanza un ataque:

```text
1×5
```

con desplazamiento de una celda.

---

# 50. Arma: Bombardero

Seleccionar:

```text
3×3
```

Servidor lanza:

```text
5 bombas
```

Cada bomba afecta una celda.

La aleatoriedad debe ejecutarse en backend.

---

# 51. Arma nuclear

Dejar fuera del MVP.

Definir luego:

- área,
- costo,
- límite,
- condiciones,
- interacción con defensas.

---

# 52. Batería antiaérea

Protege una zona de filas horizontales.

Cuando una aeronave entra:

```text
servidor valida si cruza AA
```

y puede destruirla según las reglas.

La ubicación de AA debe mantenerse secreta.

---

# 53. Submarino

Puede colocarse en una celda libre del tablero enemigo según la mecánica del juego de referencia.

Ataca con:

```text
2 torpedos
```

en línea vertical de forma aleatoria.

La posición debe ser secreta.

---

# 54. Minas

Se colocan en celdas vacías.

Si el rival impacta una mina:

```text
la misma coordenada
en su propio tablero
recibe daño
```

La mina nunca debe enviarse al cliente enemigo antes de activarse.

---

# 55. Radar

Selecciona:

```text
3×3
```

Servidor devuelve solo las celdas ocupadas o libres.

No revelar:

- tipo de barco,
- orientación,
- barco completo,
- otras posiciones fuera del área.

---

# 56. Inventario de armas

Ejemplo:

```ts
type WeaponInventory = {
  fighter: number;
  attackPlane: number;
  torpedoPlane: number;
  torpedoSquadron: number;
  bomber: number;
  nuclear: number;
  antiAir: number;
  mine: number;
  submarine: number;
  radar: number;
};
```

---

# 57. Sistema de energía o puntos

Se recomienda agregar recurso de combate:

```text
energy
```

o:

```text
points
```

para evitar spam de armas.

Ejemplo:

```text
Radar: 15
Submarino: 10
Bombardero: 100
```

Los valores se balancearán después.

---

# 58. Aleatoriedad

Toda aleatoriedad debe ocurrir en servidor.

No usar para lógica real:

```js
Math.random()
```

desde cliente.

Opcionalmente guardar:

```text
rngSeed
```

por partida para reproducir bugs.

---

# 59. Anti-cheat

Validar siempre:

- jugador autenticado,
- pertenece a la partida,
- turno correcto,
- tiempo vigente,
- coordenada válida,
- celda no atacada,
- arma disponible,
- costo disponible,
- objetivo permitido,
- flota no modificada,
- no doble acción,
- partida activa.

---

# 60. Firestore Security Rules

El cliente debe poder leer únicamente:

- estado público,
- sus datos públicos,
- ataques visibles,
- eventos públicos.

El cliente NO debe poder:

- editar el estado principal directamente,
- modificar turnos,
- cambiar ganador,
- leer barcos enemigos,
- leer minas,
- leer defensas,
- leer submarinos ocultos,
- inventar resultados.

Las acciones importantes se realizan mediante Cloud Functions.

---

# 61. Rate limit

Cloud Functions debe limitar abuso.

Ejemplo:

```text
máximo 10-20 acciones sensibles por segundo
```

También validar acciones repetidas.

---

# 62. Estado del frontend

Puede usarse Zustand:

```text
gameStore
uiStore
connectionStore
```

Pero Zustand solo sirve como réplica visual.

Firestore + backend sigue siendo la fuente de verdad.

---

# 63. Componentes React sugeridos

```text
<GameBoard />
<Cell />
<Ship />
<ShipPlacement />
<ShipInventory />

<TurnTimer />
<PlayerStatus />

<BattleLog />

<WeaponBar />
<WeaponModal />

<ConnectionStatus />
<ReconnectOverlay />

<GameResult />
```

---

# 64. Organización del proyecto

```text
seabattle/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── services/
│       └── lib/
│
├── functions/
│   └── src/
│       ├── game/
│       ├── rooms/
│       ├── attacks/
│       ├── weapons/
│       ├── timers/
│       ├── presence/
│       └── security/
│
├── packages/
│   ├── game-engine/
│   ├── shared-types/
│   └── validators/
│
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
└── package.json
```

---

# 65. Game engine

Crear lógica separada:

```text
packages/game-engine
```

Funciones:

```ts
validateFleet()
placeShip()
validateShipPlacement()

attackCell()
applyHit()
isShipSunk()
checkWinner()

executeWeapon()
validateWeaponTarget()
```

No debe depender directamente de:

- React,
- Firestore,
- UI.

Así puede testearse fácilmente.

---

# 66. Shared types

```text
packages/shared-types
```

Compartir:

```ts
GameStatus
Coordinate
Ship
AttackResult
WeaponType
PublicGameState
PlayerState
GameEvent
```

---

# 67. Zod

Validar cualquier payload.

Ejemplo:

```ts
const AttackSchema = z.object({
  gameId: z.string().min(1),
  actionId: z.string().uuid(),
  row: z.number().int().min(0).max(9),
  col: z.number().int().min(0).max(9)
});
```

---

# 68. Cloud Functions principales

Crear:

```text
createRoom
joinRoom
leaveRoom

submitFleet
autoPlaceFleet
confirmFleet

attack

useWeapon

requestRematch

syncGame
```

Además:

```text
handleTurnTimeout
handleDisconnectCleanup
finishGame
```

---

# 69. Firestore listeners

Evitar escuchar demasiados documentos.

Ideal:

```text
1 listener al game
1 listener al publicBoard propio
1 listener al publicBoard enemigo
1 listener a eventos recientes
```

No descargar todo el historial en cada cambio.

---

# 70. Control de costos

Para reducir lecturas Firestore:

- usar documentos compactos,
- evitar listeners duplicados,
- cancelar listeners al desmontar componentes,
- no escuchar toda una colección si basta un documento,
- paginar historial,
- almacenar información derivada de forma eficiente,
- no escribir el timer cada segundo.

El timer solo necesita:

```text
turnEndsAt
```

No:

```text
30
29
28
27...
```

en Firestore.

---

# 71. Persistencia

Guardar después de eventos importantes:

- crear partida,
- entrar,
- confirmar barcos,
- comenzar,
- ataque,
- arma,
- timeout,
- reconexión relevante,
- finalización.

No guardar animaciones ni estados puramente visuales.

---

# 72. Recuperación después de caída del navegador

Al abrir nuevamente:

1. Firebase Auth recupera UID.
2. Consultar partidas activas asociadas.
3. Si existe una:
   - ofrecer reanudar.
4. Suscribirse a Firestore.
5. reconstruir UI.

Ejemplo:

```text
Tienes una partida activa.

Sala K7F2QX
vs Anders

[ Reanudar ]
```

---

# 73. Recuperación después de caída del backend

Firestore conserva todo.

Cloud Tasks siguen ejecutándose en infraestructura Google.

Las Functions son stateless.

No existe un servidor local único que deba mantenerse vivo.

Esta es una ventaja importante de Firebase para este proyecto.

---

# 74. Animaciones

Agregar después de tener la lógica estable.

Ejemplos:

- torpedo,
- agua,
- explosión,
- radar,
- bombardero,
- impacto,
- barco hundiéndose.

La animación nunca debe controlar el estado real.

---

# 75. Sonido

Opcional:

- disparo,
- agua,
- impacto,
- hundido,
- último 5 segundos,
- victoria,
- derrota.

Agregar botón:

```text
🔊 / 🔇
```

---

# 76. Tests unitarios

El game engine debe probar:

- colocar barco válido,
- barco fuera del mapa,
- barco sobre otro,
- barco adyacente si está prohibido,
- ataque al agua,
- impacto,
- hundimiento,
- victoria,
- doble ataque,
- timeout,
- acción fuera de turno,
- turno expirado.

---

# 77. Tests de concurrencia

Casos importantes:

```text
ataque a los 29.999 segundos
```

vs:

```text
ataque a los 30.001 segundos
```

También:

```text
dos ataques enviados al mismo tiempo
```

Solo uno debe procesarse.

---

# 78. Tests de reconexión

Probar:

1. cerrar pestaña,
2. apagar Wi-Fi,
3. esperar timeout,
4. volver,
5. verificar sincronización,
6. recargar página,
7. cerrar navegador,
8. abrir nuevamente.

---

# 79. Tests del arsenal

Cada arma debe tener tests independientes:

- área válida,
- bordes del mapa,
- interacción con barcos,
- interacción con AA,
- interacción con minas,
- límites de uso,
- costos,
- idempotencia.

---

# 80. MVP — Fase 1

Primero implementar únicamente:

- tablero 10×10,
- Firebase Auth anónimo,
- crear sala,
- unirse,
- 2 jugadores,
- colocación manual,
- colocación automática,
- confirmar flota,
- ataques simples,
- HIT,
- MISS,
- SUNK,
- victoria,
- turnos,
- timer 30 segundos,
- timeout servidor,
- Firestore realtime,
- presencia RTDB,
- reconexión,
- persistencia.

No implementar arsenal todavía.

---

# 81. Fase 2

Después agregar:

- historial,
- revancha,
- estadísticas básicas,
- radar,
- minas,
- submarino,
- batería antiaérea.

---

# 82. Fase 3

Agregar:

- caza,
- avión de ataque,
- torpedero,
- escuadrón de torpederos,
- bombardero,
- arma nuclear,
- sistema de energía,
- balance de armas.

---

# 83. Fase 4

Agregar:

- cuentas permanentes,
- perfil,
- historial de partidas,
- victorias,
- derrotas,
- precisión,
- racha,
- ranking,
- matchmaking,
- sistema competitivo.

---

# 84. Orden exacto de implementación

## Backend base

1. Crear proyecto Firebase.
2. Activar Authentication.
3. Activar Anonymous Auth.
4. Crear Firestore.
5. Crear Realtime Database.
6. Crear proyecto de Functions v2.
7. Configurar Cloud Tasks.
8. Configurar Emulator Suite.

## Core del juego

9. Crear shared types.
10. Crear game engine.
11. Implementar tablero.
12. Implementar barcos.
13. Implementar colocación.
14. Implementar validación.
15. Implementar ataque.
16. Implementar hundimiento.
17. Implementar victoria.
18. Crear tests unitarios.

## Salas

19. Implementar createRoom.
20. Implementar joinRoom.
21. Crear código de sala.
22. Implementar room full.
23. Crear lobby.

## Flotas

24. Crear UI de colocación.
25. Drag & drop.
26. Rotación.
27. Auto placement.
28. Confirmación.
29. Guardado privado.

## Batalla

30. Crear tablero enemigo.
31. Implementar selección.
32. Implementar attack Function.
33. Implementar transaction.
34. Implementar public board.
35. Implementar historial.

## Turnos

36. Añadir currentTurnPlayerId.
37. Añadir turnNumber.
38. Añadir turnEndsAt.
39. Crear Cloud Task.
40. Crear handler de timeout.
41. Sincronizar reloj.
42. Crear UI del timer.

## Conexión

43. Implementar RTDB presence.
44. onDisconnect.
45. reconexión.
46. snapshot de estado.
47. indicador de conexión.

## Final de partida

48. detectar victoria.
49. finalizar game.
50. pantalla resultado.
51. revancha.

## Seguridad

52. Firestore Rules.
53. validación Zod.
54. idempotencia.
55. transactions.
56. rate limiting.
57. pruebas de cheating.

## Arsenal

58. crear Weapon interface.
59. Radar.
60. Minas.
61. Submarino.
62. AA.
63. Caza.
64. Avión ataque.
65. Torpedero.
66. Escuadrón.
67. Bombardero.
68. Nuclear.

---

# 85. Firestore Rules — estrategia

La política debe seguir:

```text
Lectura pública controlada
Escritura directa mínima
Datos secretos inaccesibles
Cloud Functions como autoridad
```

Ejemplo conceptual:

```text
games/{gameId}

read:
  solo jugadores de esa partida

write:
  bloquear cambios sensibles desde cliente
```

Datos privados:

```text
allow read, write: if false;
```

Cloud Functions Admin SDK ignora estas reglas y sí puede acceder.

---

# 86. Diseño de datos sugerido

## Documento game

```ts
{
  roomCode: "K7F2QX",

  status: "PLAYING",

  player1Id: "uid1",
  player2Id: "uid2",

  currentTurnPlayerId: "uid1",

  turnNumber: 12,

  turnStartedAt: Timestamp,
  turnEndsAt: Timestamp,

  winnerId: null,

  rules: {
    keepTurnOnHit: false,
    turnSeconds: 30
  },

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

# 87. Documento de jugador

```ts
{
  uid: "uid1",
  name: "Alvaro",

  ready: true,
  fleetConfirmed: true,

  joinedAt: Timestamp
}
```

La presencia debe mantenerse en RTDB, no necesariamente en este documento.

---

# 88. Public board

```ts
{
  ownerId: "uid1",

  attackedCells: {
    "0-0": "MISS",
    "2-5": "HIT",
    "5-8": "SUNK"
  }
}
```

---

# 89. Private board

```ts
{
  ownerId: "uid1",

  ships: [...],

  mines: [...],

  antiAir: [...],

  submarine: null
}
```

Solo servidor.

---

# 90. Attack document

```ts
{
  actionId: "...",

  attackerId: "uid1",
  defenderId: "uid2",

  row: 4,
  col: 7,

  result: "MISS",

  turnNumber: 12,

  createdAt: Timestamp
}
```

---

# 91. Game event

```ts
{
  type: "SHIP_SUNK",

  actorId: "uid1",

  payload: {
    shipSize: 3
  },

  createdAt: Timestamp
}
```

---

# 92. UX de reconexión

Cuando se cae la conexión:

```text
Conexión perdida

La partida continúa en el servidor.

Reconectando...
```

No ocultar toda la interfaz.

Cuando vuelve:

```text
Sincronizando partida...
```

Después:

```text
Conectado
```

---

# 93. UX cuando el rival se desconecta

Mostrar:

```text
Anders se desconectó.

La partida continuará.
```

Opcional:

```text
Puede volver durante los próximos 5 minutos.
```

---

# 94. Accesibilidad

Incluir:

- tamaños táctiles grandes,
- contraste suficiente,
- estados no dependientes solo de color,
- labels,
- botones con texto,
- soporte teclado en desktop.

---

# 95. Diseño visual

Mantener la inspiración del juego mostrado:

- papel cuadriculado,
- tinta azul/violeta,
- barcos dibujados,
- estilo cuaderno,
- botones tipo boceto.

Pero modernizar:

- responsive,
- menos elementos amontonados,
- paneles claros,
- animaciones suaves,
- tipografía legible.

---

# 96. Prioridades técnicas

Orden de importancia:

```text
1. Seguridad
2. Consistencia
3. Reconexión
4. Turnos
5. Persistencia
6. UX
7. Animaciones
8. Arsenal
```

---

# 97. Cosas que NO hacer

No:

```text
guardar barcos enemigos en React
```

No:

```text
dejar que el cliente decida HIT/MISS
```

No:

```text
usar setTimeout del navegador como timer oficial
```

No:

```text
guardar el contador cada segundo en Firestore
```

No:

```text
dejar que el cliente modifique currentTurnPlayerId
```

No:

```text
confiar en datos enviados por el jugador
```

No:

```text
procesar dos veces un actionId
```

---

# 98. Definición de terminado para el MVP

El MVP está listo cuando:

- dos dispositivos pueden jugar,
- se puede crear sala,
- se puede entrar por código,
- ambos colocan barcos,
- comienza la partida,
- cada jugador ve su tablero,
- enemigo no recibe barcos ocultos,
- ataques se sincronizan,
- timer funciona,
- timeout cambia turno,
- recarga de página funciona,
- caída de Internet funciona,
- reconexión funciona,
- un ataque no puede duplicarse,
- no se puede atacar fuera de turno,
- no se puede manipular el resultado desde DevTools,
- se detecta victoria,
- la partida termina correctamente.

---

# 99. Resultado final esperado

Arquitectura:

```text
              FIREBASE AUTH
                    │
                    ▼

Jugador A ────── Next.js ────── Jugador B
                    │
             intenciones
                    │
                    ▼
           CLOUD FUNCTIONS
                    │
             lógica autoritativa
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    FIRESTORE              CLOUD TASKS
 estado persistente       timeout de turno
         │
         ▼
     onSnapshot
     │         │
     ▼         ▼
 Jugador A  Jugador B

Realtime Database:
presencia / online / offline
```

---

# 100. Meta final del proyecto

Construir un Sea Battle moderno, multijugador, robusto y preparado para crecer.

El objetivo no es solo tener:

```text
dos tableros y disparos
```

sino crear una base capaz de soportar posteriormente:

- arsenal avanzado,
- partidas competitivas,
- ranking,
- temporadas,
- estadísticas,
- cuentas,
- replays,
- espectadores,
- matchmaking,
- modos especiales.

La arquitectura Firebase propuesta permite comenzar con un MVP relativamente sencillo sin sacrificar seguridad, persistencia ni posibilidad de expansión.
