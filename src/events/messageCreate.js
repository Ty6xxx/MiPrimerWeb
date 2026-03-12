/**
 * Evento: messageCreate
 * Maneja mensajes del chat para retransmitir al juego
 */

const logger = require('../utils/logger');

module.exports = {
    name: 'messageCreate',
    once: false,
    async execute(client, message) {
        // Ignorar mensajes de bots
        if (message.author.bot) return;

        // Si el mensaje es en el canal de comandos, retransmitir al juego
        if (client.config.commandChannelId && message.channelId === client.config.commandChannelId) {
            if (client.rustManager && client.rustManager.isConnected) {
                const sent = await client.rustManager.sendTeamMessage(
                    `[Discord] ${message.author.username}: ${message.content}`
                );
                if (sent) {
                    await message.react('✅');
                }
            }
        }
    },
};
