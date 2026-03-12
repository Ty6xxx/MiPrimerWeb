/**
 * Rust Bot Custom - Punto de entrada principal
 * Bot de Discord para gestión de servidores Rust
 * Inspirado en rustplusplus (https://github.com/alexemanuelol/rustplusplus)
 *
 * Este es un proyecto propio que toma como referencia la arquitectura
 * y funcionalidades de rustplusplus para crear una implementación personalizada.
 */

require('dotenv').config();
const logger = require('./utils/logger');
const DiscordBot = require('./structures/DiscordBot');

// Banner de inicio
logger.info('=========================================');
logger.info('  Rust Bot Custom v1.0.0');
logger.info('  Inspirado en rustplusplus');
logger.info('=========================================');

// Validar variables de entorno críticas
if (!process.env.DISCORD_TOKEN) {
    logger.error('DISCORD_TOKEN no configurado. Revisa tu archivo .env');
    logger.info('Copia .env.example a .env y configura tus credenciales');
    process.exit(1);
}

// Crear instancia del bot
const client = new DiscordBot();

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
    logger.error(`Unhandled Rejection: ${error.message || error}`);
});

process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    process.exit(1);
});

// Manejo de señales de terminación
process.on('SIGINT', () => {
    logger.info('Cerrando bot...');
    if (client.rustManager) {
        client.rustManager.disconnect();
    }
    client.destroy();
    process.exit(0);
});

// Arrancar el bot
client.build();

module.exports = client;
