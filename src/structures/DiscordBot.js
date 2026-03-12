/**
 * DiscordBot - Clase principal del bot de Discord
 * Inspirada en la clase DiscordBot de rustplusplus
 * Extiende Discord.Client con funcionalidades específicas para Rust
 */

const { Client, Collection, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const RustPlusManager = require('./RustPlusManager');

class DiscordBot extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildVoiceStates,
            ],
            rest: {
                timeout: 30000,
            },
        });

        // Colección de comandos slash
        this.commands = new Collection();

        // Instancia de RustPlusManager
        this.rustManager = null;

        // Configuración del servidor
        this.config = {
            guildId: process.env.GUILD_ID || '',
            notificationChannelId: null,
            commandChannelId: null,
        };

        // Canales de notificación por tipo de evento
        this.eventChannels = new Map();
    }

    /**
     * Construir y arrancar el bot
     */
    async build() {
        logger.info('Iniciando construcción del bot...');

        // Crear directorios necesarios
        this._createDirectories();

        // Cargar comandos
        await this._loadCommands();

        // Cargar eventos de Discord
        await this._loadEvents();

        // Inicializar RustPlus Manager
        await this._initRustPlus();

        // Login en Discord
        try {
            await this.login(process.env.DISCORD_TOKEN);
            logger.info('Bot conectado a Discord exitosamente');
        } catch (error) {
            logger.error(`Error al conectar con Discord: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Crear directorios necesarios
     */
    _createDirectories() {
        const dirs = ['logs', 'data'];
        for (const dir of dirs) {
            const dirPath = path.join(__dirname, '..', '..', dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                logger.info(`Directorio creado: ${dir}`);
            }
        }
    }

    /**
     * Cargar todos los comandos slash desde el directorio commands/
     */
    async _loadCommands() {
        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFolders = fs.readdirSync(commandsPath).filter(f =>
            fs.statSync(path.join(commandsPath, f)).isDirectory()
        );

        for (const folder of commandFolders) {
            const folderPath = path.join(commandsPath, folder);
            const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                try {
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        this.commands.set(command.data.name, command);
                        logger.info(`Comando cargado: /${command.data.name} [${folder}]`);
                    } else {
                        logger.warn(`Comando incompleto: ${filePath}`);
                    }
                } catch (error) {
                    logger.error(`Error cargando comando ${file}: ${error.message}`);
                }
            }
        }

        logger.info(`Total de comandos cargados: ${this.commands.size}`);
    }

    /**
     * Registrar comandos slash en Discord
     */
    async registerSlashCommands() {
        const commands = this.commands.map(cmd => cmd.data.toJSON());

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            logger.info(`Registrando ${commands.length} comandos slash...`);

            if (this.config.guildId) {
                // Registro en guild específico (más rápido para desarrollo)
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, this.config.guildId),
                    { body: commands }
                );
            } else {
                // Registro global
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands }
                );
            }

            logger.info('Comandos slash registrados exitosamente');
        } catch (error) {
            logger.error(`Error registrando comandos: ${error.message}`);
        }
    }

    /**
     * Cargar eventos de Discord
     */
    async _loadEvents() {
        const eventsPath = path.join(__dirname, '..', 'events');

        if (!fs.existsSync(eventsPath)) {
            logger.warn('Directorio de eventos no encontrado');
            return;
        }

        const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            try {
                const event = require(filePath);
                if (event.once) {
                    this.once(event.name, (...args) => event.execute(this, ...args));
                } else {
                    this.on(event.name, (...args) => event.execute(this, ...args));
                }
                logger.info(`Evento cargado: ${event.name}`);
            } catch (error) {
                logger.error(`Error cargando evento ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Inicializar conexión con Rust+
     */
    async _initRustPlus() {
        const { RUST_SERVER_IP, RUST_SERVER_PORT, RUST_STEAM_ID, RUST_PLAYER_TOKEN } = process.env;

        if (!RUST_SERVER_IP || !RUST_PLAYER_TOKEN) {
            logger.warn('Configuración de Rust+ incompleta. Usando modo simulación.');
        }

        this.rustManager = new RustPlusManager(
            RUST_SERVER_IP || '127.0.0.1',
            RUST_SERVER_PORT || '28015',
            RUST_STEAM_ID || '0',
            RUST_PLAYER_TOKEN || ''
        );

        // Vincular eventos de Rust+ con Discord
        this.rustManager.on('connected', () => {
            logger.info('RustPlus conectado - Bot listo para operar');
        });

        this.rustManager.on('gameEvent', (event) => {
            this._notifyGameEvent(event);
        });

        this.rustManager.on('teamMessage', (message) => {
            this._relayTeamMessage(message);
        });

        await this.rustManager.build();
    }

    /**
     * Notificar evento del juego en Discord
     */
    async _notifyGameEvent(event) {
        const DiscordEmbeds = require('../utils/embeds');
        const channelId = this.config.notificationChannelId;

        if (!channelId) return;

        try {
            const channel = await this.channels.fetch(channelId);
            if (channel) {
                const embed = DiscordEmbeds.getEventEmbed(event.type, event);
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            logger.error(`Error enviando notificación: ${error.message}`);
        }
    }

    /**
     * Retransmitir mensaje del equipo a Discord
     */
    async _relayTeamMessage(message) {
        const channelId = this.config.commandChannelId;

        if (!channelId) return;

        try {
            const channel = await this.channels.fetch(channelId);
            if (channel) {
                await channel.send(`**[Rust Team Chat]** ${message.name}: ${message.message}`);
            }
        } catch (error) {
            logger.error(`Error retransmitiendo mensaje: ${error.message}`);
        }
    }

    /**
     * Método auxiliar para responder interacciones de forma segura
     */
    async interactionReply(interaction, content, ephemeral = false) {
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(content);
            } else {
                await interaction.reply({ ...content, ephemeral });
            }
        } catch (error) {
            logger.error(`Error respondiendo interacción: ${error.message}`);
        }
    }

    /**
     * Configurar canal de notificaciones
     */
    setNotificationChannel(channelId) {
        this.config.notificationChannelId = channelId;
        logger.info(`Canal de notificaciones: ${channelId}`);
    }

    /**
     * Configurar canal de comandos
     */
    setCommandChannel(channelId) {
        this.config.commandChannelId = channelId;
        logger.info(`Canal de comandos: ${channelId}`);
    }
}

module.exports = DiscordBot;
