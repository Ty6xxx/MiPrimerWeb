# Rust Bot Custom

Bot de Discord para gestión y monitoreo de servidores Rust. Inspirado en [rustplusplus](https://github.com/alexemanuelol/rustplusplus).

## Características

- **Estado del Servidor**: Monitoreo en tiempo real de jugadores, mapa y tiempo del juego
- **Eventos del Mapa**: Notificaciones automáticas de Cargo Ship, Patrol Heli, Chinook, Bradley APC
- **Dispositivos Inteligentes**: Control remoto de switches, alarmas y monitores de almacenamiento
- **Team Chat Bridge**: Retransmisión de mensajes entre Discord y el chat del equipo en Rust
- **Información del Equipo**: Estado online/offline de miembros del equipo
- **Sistema Modular**: Arquitectura extensible con comandos, eventos y handlers separados

## Estructura del Proyecto

```
src/
├── index.js                 # Punto de entrada
├── commands/
│   ├── general/             # Comandos generales (help, ping, info)
│   ├── rust/                # Comandos de Rust (server, time, team, map, switch, devices, alarm)
│   └── admin/               # Comandos de administración (setchannel, settings)
├── events/                  # Eventos de Discord (ready, interactionCreate, messageCreate)
├── handlers/                # Handlers de interacciones (botones, menús, modales)
├── structures/              # Clases principales (DiscordBot, RustPlusManager)
├── utils/                   # Utilidades (logger, embeds, constants)
└── config/                  # Gestión de configuración
```

## Instalación

1. Clona el repositorio
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Copia el archivo de configuración:
   ```bash
   cp .env.example .env
   ```
4. Configura tu `.env` con:
   - `DISCORD_TOKEN` - Token del bot de Discord
   - `CLIENT_ID` - ID de la aplicación de Discord
   - `GUILD_ID` - ID del servidor de Discord
   - Credenciales de Rust+ (opcional, funciona en modo simulación sin ellas)

5. Inicia el bot:
   ```bash
   npm start
   ```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `/help` | Muestra todos los comandos disponibles |
| `/ping` | Verifica la latencia del bot |
| `/info` | Información sobre el bot |
| `/server` | Estado del servidor Rust |
| `/time` | Hora actual en el servidor |
| `/team` | Información del equipo |
| `/players` | Jugadores conectados |
| `/map` | Eventos activos en el mapa |
| `/switch` | Controlar switches inteligentes |
| `/devices` | Gestionar dispositivos registrados |
| `/alarm` | Gestionar alarmas |
| `/setchannel` | Configurar canales del bot |
| `/settings` | Ver configuración actual |

## Tecnologías

- **Node.js** - Runtime
- **Discord.js v14** - Librería de Discord
- **@liamcottle/rustplus.js** - API de Rust+
- **Winston** - Sistema de logging

## Créditos

Proyecto inspirado en [rustplusplus](https://github.com/alexemanuelol/rustplusplus) por Alexander Emanuelsson.
