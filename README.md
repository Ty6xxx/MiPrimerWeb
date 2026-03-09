# Rust+ Discord Bot

Bot de Discord que se conecta a servidores de Rust via Rust+ API para controlar Smart Devices, recibir notificaciones de eventos, chatear con el equipo y buscar items en Vending Machines.

## Requisitos

- Node.js 18+
- Una aplicacion de Discord Bot ([crear aqui](https://discord.com/developers/applications))
- Datos de conexion Rust+ (Server IP, App Port, Steam ID, Player Token)

## Instalacion

```bash
cd rust-bot
npm install
cp .env.example .env
# Edita .env con tus credenciales
```

## Configuracion .env

```
DISCORD_TOKEN=         # Token del bot de Discord
DISCORD_CLIENT_ID=     # Client ID de la app de Discord
RUST_SERVER_IP=        # IP del servidor de Rust
RUST_SERVER_PORT=      # App Port (del server.cfg)
RUST_PLAYER_ID=        # Tu Steam ID de 64 bits
RUST_PLAYER_TOKEN=     # Tu Player Token de Rust+
```

### Obtener Player Token

```bash
npx @liamcottle/rustplus.js fcm-register
npx @liamcottle/rustplus.js fcm-listen
```

Luego empareja el servidor desde el juego.

## Uso

```bash
npm start
```

## Comandos de Discord

| Comando | Descripcion |
|---------|-------------|
| `/server` | Info del servidor |
| `/time` | Hora del servidor |
| `/team` | Info del equipo |
| `/pop` | Jugadores online |
| `/switch on/off/status <device>` | Controlar Smart Switch |
| `/device-add <name> <entity_id>` | Registrar dispositivo |
| `/device-remove <name>` | Eliminar dispositivo |
| `/devices` | Listar dispositivos |
| `/vending <item>` | Buscar en Vending Machines |
| `/say <message>` | Enviar mensaje al team chat |

## Comandos de Team Chat (in-game)

| Comando | Descripcion |
|---------|-------------|
| `!on <device>` | Encender switch |
| `!off <device>` | Apagar switch |
| `!status <device>` | Estado del switch |
| `!time` | Hora del servidor |
| `!pop` | Jugadores online |
| `!team` | Info del equipo |
| `!help` | Lista de comandos |

## Notificaciones automaticas

El bot detecta y notifica automaticamente:
- Cargo Ship
- Patrol Helicopter
- CH47 Chinook
- Explosiones
- Crates
