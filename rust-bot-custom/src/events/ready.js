/**
 * Evento: ready
 * Se ejecuta cuando el bot se conecta a Discord exitosamente
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Bot conectado como: ${client.user.tag}`);
        logger.info(`Servidores: ${client.guilds.cache.size}`);
        logger.info(`Usuarios: ${client.users.cache.size}`);

        // Establecer actividad del bot
        client.user.setActivity('Rust Server | /help', { type: 3 }); // Watching

        // Registrar comandos slash
        await client.registerSlashCommands();

        logger.info('Bot listo y operativo');
    },
};
