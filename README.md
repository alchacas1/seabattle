# Sea Battle (Node + React + TypeScript)

1v1 online con autoridad en backend y comunicación por WebSockets (Socket.IO).

## Quickstart

Requisitos: Node.js 18+

En dos terminales o con un comando:

- Todo junto: `npm run dev`

O por separado:

- Backend: `npm run dev:server`
- Frontend: `npm run dev:client`

URLs por defecto:

- Server: http://localhost:3001/health
- Client: http://localhost:5173

## Cómo jugar (demo mínima)

1. Abre 2 pestañas/ventanas del cliente (dos jugadores).
2. En una: **Crear partida** y copia el `gameId`.
3. En la otra: pega el `gameId` y **Unirse**.
4. En ambas: **Auto-colocar + Ready**.
5. Dispara haciendo click en el tablero enemigo cuando sea tu turno.

## Config

- Frontend usa `VITE_SERVER_URL` (opcional). Default: `http://localhost:3001`.

## Estructura

- `server/`: Node + TS + Express (health) + Socket.IO + lógica de juego
- `client/`: React + TS (Vite) + Zustand + Socket.IO client
