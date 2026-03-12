/**
 * RustPlusManager - Gestión de conexión con servidores Rust
 * Inspirado en la clase RustPlus de rustplusplus
 * Maneja la conexión al servidor, rate limiting con tokens, y obtención de datos
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const { TOKENS, UPDATE_INTERVALS, GAME_EVENTS } = require('../utils/constants');

class RustPlusManager extends EventEmitter {
    constructor(serverIp, serverPort, steamId, playerToken) {
        super();

        this.serverIp = serverIp;
        this.serverPort = serverPort;
        this.steamId = steamId;
        this.playerToken = playerToken;

        // Sistema de tokens para rate limiting (como rustplusplus)
        this.tokens = TOKENS.MAX;
        this.tokenReplenishInterval = null;

        // Estado de conexión
        this.isConnected = false;
        this.rustplus = null;

        // Caché de datos del servidor
        this.serverInfo = null;
        this.teamInfo = null;
        this.mapMarkers = null;
        this.timeInfo = null;

        // Dispositivos inteligentes registrados
        this.smartDevices = new Map();

        // Eventos activos del mapa
        this.activeEvents = new Map();

        // Intervalos de actualización
        this.updateIntervals = [];
    }

    /**
     * Construir e iniciar la conexión
     */
    async build() {
        logger.info(`Conectando al servidor Rust: ${this.serverIp}:${this.serverPort}`);

        try {
            // Intentar cargar rustplus.js dinámicamente
            let RustPlus;
            try {
                RustPlus = require('@liamcottle/rustplus.js');
            } catch (e) {
                logger.warn('rustplus.js no encontrado. Ejecutando en modo simulación.');
                this._startSimulationMode();
                return;
            }

            this.rustplus = new RustPlus(this.serverIp, this.serverPort, this.steamId, this.playerToken);

            // Configurar eventos de rustplus
            this.rustplus.on('connected', () => this._onConnected());
            this.rustplus.on('disconnected', () => this._onDisconnected());
            this.rustplus.on('error', (err) => this._onError(err));
            this.rustplus.on('message', (msg) => this._onMessage(msg));

            // Iniciar sistema de tokens
            this._startTokenReplenish();

            // Conectar
            this.rustplus.connect();
        } catch (error) {
            logger.error(`Error al construir RustPlusManager: ${error.message}`);
            this._startSimulationMode();
        }
    }

    /**
     * Modo simulación cuando no hay servidor disponible
     */
    _startSimulationMode() {
        logger.info('Iniciando en modo simulación...');
        this.isConnected = true;
        this._startTokenReplenish();

        // Datos simulados
        this.serverInfo = {
            name: 'Rust Server [SIMULACIÓN]',
            players: Math.floor(Math.random() * 100),
            maxPlayers: 200,
            map: 'Procedural Map',
            seed: 123456,
            size: 4000,
            online: true,
        };

        this.timeInfo = { time: 12.0, sunrise: 6.0, sunset: 18.0 };

        this.teamInfo = [
            { name: 'Jugador1', steamId: '76561198000000001', isOnline: true, isAlive: true, isLeader: true },
            { name: 'Jugador2', steamId: '76561198000000002', isOnline: true, isAlive: true, isLeader: false },
            { name: 'Jugador3', steamId: '76561198000000003', isOnline: false, isAlive: false, isLeader: false },
        ];

        this.emit('connected');

        // Simular eventos periódicos
        this._simulateEvents();
    }

    /**
     * Simular eventos del juego para demo
     */
    _simulateEvents() {
        const interval = setInterval(() => {
            if (!this.isConnected) {
                clearInterval(interval);
                return;
            }

            // Actualizar tiempo simulado
            if (this.timeInfo) {
                this.timeInfo.time = (this.timeInfo.time + 0.5) % 24;
            }

            // Actualizar jugadores simulados
            if (this.serverInfo) {
                this.serverInfo.players = Math.floor(Math.random() * 200);
            }

            // Evento aleatorio ocasional
            if (Math.random() < 0.1) {
                const events = Object.values(GAME_EVENTS);
                const randomEvent = events[Math.floor(Math.random() * events.length)];
                this.emit('gameEvent', {
                    type: randomEvent,
                    x: Math.random() * 4000,
                    y: Math.random() * 4000,
                });
            }
        }, UPDATE_INTERVALS.SERVER_STATUS);

        this.updateIntervals.push(interval);
    }

    // === Sistema de Tokens (Rate Limiting) ===

    _startTokenReplenish() {
        this.tokenReplenishInterval = setInterval(() => {
            this.tokens = Math.min(TOKENS.MAX, this.tokens + TOKENS.REPLENISH_RATE);
        }, UPDATE_INTERVALS.TOKEN_REPLENISH);
    }

    async _waitForTokens(cost) {
        while (this.tokens < cost) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.tokens -= cost;
    }

    // === Eventos de Conexión ===

    _onConnected() {
        logger.info('Conectado al servidor Rust exitosamente');
        this.isConnected = true;
        this.emit('connected');
        this._startUpdates();
    }

    _onDisconnected() {
        logger.warn('Desconectado del servidor Rust');
        this.isConnected = false;
        this._stopUpdates();
        this.emit('disconnected');
    }

    _onError(error) {
        logger.error(`Error de RustPlus: ${error.message || error}`);
        this.emit('error', error);
    }

    _onMessage(message) {
        // Procesar mensajes broadcast (eventos del servidor)
        if (message.broadcast) {
            this._processBroadcast(message.broadcast);
        }
    }

    _processBroadcast(broadcast) {
        if (broadcast.teamMessage) {
            this.emit('teamMessage', broadcast.teamMessage.message);
        }
        if (broadcast.entityChanged) {
            this.emit('entityChanged', broadcast.entityChanged);
        }
    }

    // === Actualización Periódica ===

    _startUpdates() {
        // Actualizar estado del servidor
        const serverInterval = setInterval(async () => {
            await this.getServerInfo();
        }, UPDATE_INTERVALS.SERVER_STATUS);

        // Actualizar info de equipo
        const teamInterval = setInterval(async () => {
            await this.getTeamInfo();
        }, UPDATE_INTERVALS.TEAM_INFO);

        // Actualizar marcadores del mapa
        const mapInterval = setInterval(async () => {
            await this.getMapMarkers();
        }, UPDATE_INTERVALS.MAP_EVENTS);

        this.updateIntervals.push(serverInterval, teamInterval, mapInterval);
    }

    _stopUpdates() {
        this.updateIntervals.forEach(interval => clearInterval(interval));
        this.updateIntervals = [];
        if (this.tokenReplenishInterval) {
            clearInterval(this.tokenReplenishInterval);
        }
    }

    // === API del Servidor ===

    /**
     * Obtener información del servidor
     */
    async getServerInfo() {
        if (!this.isConnected) return this.serverInfo;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.GET_TIME);
            try {
                const info = await this.rustplus.getInfo();
                if (info && info.response && info.response.info) {
                    this.serverInfo = {
                        name: info.response.info.name,
                        players: info.response.info.players,
                        maxPlayers: info.response.info.maxPlayers,
                        map: info.response.info.map,
                        seed: info.response.info.seed,
                        size: info.response.info.mapSize,
                        online: true,
                    };
                }
            } catch (error) {
                logger.error(`Error obteniendo info del servidor: ${error.message}`);
            }
        }

        return this.serverInfo;
    }

    /**
     * Obtener tiempo del juego
     */
    async getTime() {
        if (!this.isConnected) return this.timeInfo;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.GET_TIME);
            try {
                const time = await this.rustplus.getTime();
                if (time && time.response && time.response.time) {
                    this.timeInfo = {
                        time: time.response.time.time,
                        sunrise: time.response.time.sunrise,
                        sunset: time.response.time.sunset,
                    };
                }
            } catch (error) {
                logger.error(`Error obteniendo tiempo: ${error.message}`);
            }
        }

        return this.timeInfo;
    }

    /**
     * Obtener información del equipo
     */
    async getTeamInfo() {
        if (!this.isConnected) return this.teamInfo;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.GET_TEAM_INFO);
            try {
                const team = await this.rustplus.getTeamInfo();
                if (team && team.response && team.response.teamInfo) {
                    this.teamInfo = team.response.teamInfo.members.map(m => ({
                        name: m.name,
                        steamId: m.steamId.toString(),
                        isOnline: m.isOnline,
                        isAlive: m.isAlive,
                        isLeader: m.isLeader || false,
                        x: m.x,
                        y: m.y,
                    }));
                }
            } catch (error) {
                logger.error(`Error obteniendo info del equipo: ${error.message}`);
            }
        }

        return this.teamInfo;
    }

    /**
     * Obtener marcadores del mapa (eventos)
     */
    async getMapMarkers() {
        if (!this.isConnected) return this.mapMarkers;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.GET_MAP_MARKERS);
            try {
                const markers = await this.rustplus.getMapMarkers();
                if (markers && markers.response && markers.response.mapMarkers) {
                    const newMarkers = markers.response.mapMarkers.markers;
                    this._detectNewEvents(newMarkers);
                    this.mapMarkers = newMarkers;
                }
            } catch (error) {
                logger.error(`Error obteniendo marcadores: ${error.message}`);
            }
        }

        return this.mapMarkers;
    }

    /**
     * Detectar nuevos eventos comparando con marcadores anteriores
     */
    _detectNewEvents(newMarkers) {
        if (!this.mapMarkers) return;

        const markerTypes = {
            2: GAME_EVENTS.EXPLOSION,
            4: GAME_EVENTS.CHINOOK,
            5: GAME_EVENTS.CARGO_SHIP,
            6: GAME_EVENTS.OIL_RIG_SMALL,
            8: GAME_EVENTS.PATROL_HELI,
        };

        const oldIds = new Set(this.mapMarkers.map(m => m.id));

        for (const marker of newMarkers) {
            if (!oldIds.has(marker.id) && markerTypes[marker.type]) {
                this.emit('gameEvent', {
                    type: markerTypes[marker.type],
                    x: marker.x,
                    y: marker.y,
                    id: marker.id,
                });
            }
        }
    }

    // === Control de Dispositivos Inteligentes ===

    /**
     * Obtener info de una entidad (switch, alarma, storage)
     */
    async getEntityInfo(entityId) {
        if (!this.isConnected) return null;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.GET_ENTITY_INFO);
            try {
                const info = await this.rustplus.getEntityInfo(entityId);
                if (info && info.response && info.response.entityInfo) {
                    return info.response.entityInfo;
                }
            } catch (error) {
                logger.error(`Error obteniendo entidad ${entityId}: ${error.message}`);
            }
        }

        // Simulación
        return {
            type: 1,
            value: Math.random() > 0.5,
            capacity: 0,
            hasProtection: false,
        };
    }

    /**
     * Activar/desactivar un switch inteligente
     */
    async toggleSmartSwitch(entityId, value) {
        if (!this.isConnected) {
            logger.warn('No conectado al servidor para controlar dispositivos');
            return false;
        }

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.SET_ENTITY_VALUE);
            try {
                await this.rustplus.setEntityValue(entityId, value);
                logger.info(`Switch ${entityId} ${value ? 'encendido' : 'apagado'}`);
                return true;
            } catch (error) {
                logger.error(`Error controlando switch ${entityId}: ${error.message}`);
                return false;
            }
        }

        // Simulación
        logger.info(`[SIM] Switch ${entityId} ${value ? 'encendido' : 'apagado'}`);
        return true;
    }

    /**
     * Enviar mensaje al chat del equipo
     */
    async sendTeamMessage(message) {
        if (!this.isConnected) return false;

        if (this.rustplus) {
            await this._waitForTokens(TOKENS.COST.SEND_TEAM_MESSAGE);
            try {
                await this.rustplus.sendTeamMessage(message);
                return true;
            } catch (error) {
                logger.error(`Error enviando mensaje: ${error.message}`);
                return false;
            }
        }

        logger.info(`[SIM] Mensaje enviado: ${message}`);
        return true;
    }

    /**
     * Registrar un dispositivo inteligente para seguimiento
     */
    registerDevice(entityId, name, type) {
        this.smartDevices.set(String(entityId), { entityId, name, type });
        logger.info(`Dispositivo registrado: ${name} (ID: ${entityId})`);
    }

    /**
     * Eliminar un dispositivo del seguimiento
     */
    unregisterDevice(entityId) {
        this.smartDevices.delete(String(entityId));
        logger.info(`Dispositivo eliminado: ${entityId}`);
    }

    /**
     * Obtener todos los dispositivos registrados
     */
    getRegisteredDevices() {
        return Array.from(this.smartDevices.values());
    }

    /**
     * Desconectar del servidor
     */
    disconnect() {
        this._stopUpdates();
        if (this.rustplus) {
            this.rustplus.disconnect();
        }
        this.isConnected = false;
        logger.info('Desconectado del servidor Rust');
    }
}

module.exports = RustPlusManager;
