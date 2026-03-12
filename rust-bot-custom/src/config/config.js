/**
 * Módulo de Configuración
 * Gestiona la persistencia de configuración del bot
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const CONFIG_FILE = path.join(__dirname, '..', '..', 'data', 'config.json');

const defaultConfig = {
    guilds: {},
    devices: [],
    notifications: {
        cargoShip: true,
        patrolHelicopter: true,
        ch47: true,
        bradleyApc: true,
        oilRig: true,
        teamLogin: true,
        teamLogout: true,
    },
};

class ConfigManager {
    constructor() {
        this.config = this._load();
    }

    _load() {
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
                return { ...defaultConfig, ...JSON.parse(data) };
            }
        } catch (error) {
            logger.error(`Error cargando configuración: ${error.message}`);
        }
        return { ...defaultConfig };
    }

    save() {
        try {
            const dir = path.dirname(CONFIG_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
            logger.info('Configuración guardada');
        } catch (error) {
            logger.error(`Error guardando configuración: ${error.message}`);
        }
    }

    getGuildConfig(guildId) {
        if (!this.config.guilds[guildId]) {
            this.config.guilds[guildId] = {
                notificationChannelId: null,
                commandChannelId: null,
                language: 'es',
            };
        }
        return this.config.guilds[guildId];
    }

    setGuildConfig(guildId, key, value) {
        if (!this.config.guilds[guildId]) {
            this.getGuildConfig(guildId);
        }
        this.config.guilds[guildId][key] = value;
        this.save();
    }

    getNotificationSettings() {
        return this.config.notifications;
    }

    setNotification(type, enabled) {
        this.config.notifications[type] = enabled;
        this.save();
    }

    getDevices() {
        return this.config.devices;
    }

    addDevice(device) {
        this.config.devices.push(device);
        this.save();
    }

    removeDevice(entityId) {
        this.config.devices = this.config.devices.filter(d => d.entityId !== entityId);
        this.save();
    }
}

module.exports = new ConfigManager();
