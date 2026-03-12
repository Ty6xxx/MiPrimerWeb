/**
 * Constantes del bot - Inspirado en rustplusplus
 * Configuración centralizada de colores, emojis, URLs y límites
 */

module.exports = {
    // URLs del juego Rust
    URLS: {
        STEAM_PROFILE: 'https://steamcommunity.com/profiles/',
        BATTLEMETRICS: 'https://www.battlemetrics.com/players/',
        RUST_STORE: 'https://store.steampowered.com/app/252490/Rust/',
    },

    // Tiempo AFK en milisegundos (5 minutos)
    AFK_TIMEOUT: 5 * 60 * 1000,

    // Intervalos de actualización
    UPDATE_INTERVALS: {
        SERVER_STATUS: 30 * 1000,      // 30 segundos
        TEAM_INFO: 60 * 1000,          // 1 minuto
        MAP_EVENTS: 45 * 1000,         // 45 segundos
        TOKEN_REPLENISH: 1000,         // 1 segundo
    },

    // Sistema de tokens para rate limiting (similar a rustplusplus)
    TOKENS: {
        MAX: 24,
        REPLENISH_RATE: 3,             // tokens por segundo
        COST: {
            GET_MAP: 5,
            GET_TIME: 1,
            GET_TEAM_INFO: 1,
            GET_ENTITY_INFO: 1,
            SET_ENTITY_VALUE: 1,
            GET_MAP_MARKERS: 1,
            SEND_TEAM_MESSAGE: 2,
        },
    },

    // Colores para embeds de Discord
    COLORS: {
        DEFAULT: '#ce412b',
        SUCCESS: '#00ff40',
        ERROR: '#ff0000',
        WARNING: '#ffaa00',
        INFO: '#0099ff',
        ONLINE: '#00ff00',
        OFFLINE: '#ff0000',
        AFK: '#ffff00',
        CARGO_SHIP: '#6e00b3',
        PATROL_HELI: '#df691a',
        CHINOOK: '#00bfff',
        OIL_RIG: '#b5651d',
        BRADLEY: '#808080',
    },

    // Emojis para estados y eventos
    EMOJIS: {
        ONLINE: ':green_circle:',
        OFFLINE: ':red_circle:',
        AFK: ':yellow_circle:',
        DAY: ':sunny:',
        NIGHT: ':crescent_moon:',
        LOCKED: ':lock:',
        UNLOCKED: ':unlock:',
        ON: ':white_check_mark:',
        OFF: ':x:',
        CARGO: ':ship:',
        HELI: ':helicopter:',
        CHINOOK: ':airplane:',
        OIL_RIG: ':oil_drum:',
        BRADLEY: ':military_helmet:',
        ALARM: ':rotating_light:',
        SWITCH: ':electric_plug:',
        STORAGE: ':package:',
    },

    // Límites de Discord embeds
    EMBED_LIMITS: {
        TITLE: 256,
        DESCRIPTION: 4096,
        FIELDS: 25,
        FIELD_NAME: 256,
        FIELD_VALUE: 1024,
        FOOTER: 2048,
        AUTHOR_NAME: 256,
        TOTAL: 6000,
    },

    // Eventos del juego Rust
    GAME_EVENTS: {
        CARGO_SHIP: 'cargoShip',
        PATROL_HELI: 'patrolHelicopter',
        CHINOOK: 'ch47',
        OIL_RIG_SMALL: 'oilRigSmall',
        OIL_RIG_LARGE: 'oilRigLarge',
        BRADLEY: 'bradleyApc',
        EXPLOSION: 'explosion',
    },

    // Capacidades de almacenamiento en Rust
    STORAGE_CAPACITY: {
        TOOL_CUPBOARD: 24,
        LARGE_WOOD_BOX: 30,
        SMALL_STASH: 6,
        VENDING_MACHINE: 30,
        FURNACE: 3,
        LARGE_FURNACE: 18,
        REFINERY: 3,
    },

    // Temporizadores del juego
    GAME_TIMERS: {
        CARGO_DURATION: 50 * 60,           // 50 minutos en segundos
        OIL_RIG_CRATE_TIMER: 15 * 60,     // 15 minutos
        BRADLEY_RESPAWN: 60 * 60,          // 1 hora
        HELI_RESPAWN: 2 * 60 * 60,        // 2 horas
    },

    // Tipos de entidades inteligentes
    ENTITY_TYPES: {
        SWITCH: 1,
        ALARM: 2,
        STORAGE_MONITOR: 3,
    },
};
