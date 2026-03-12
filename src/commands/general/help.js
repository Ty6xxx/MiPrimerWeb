/**
 * Comando: /help
 * Muestra todos los comandos disponibles del bot
 */

const { SlashCommandBuilder } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra todos los comandos disponibles'),

    async execute(client, interaction) {
        const commands = {
            'General': [
                { name: 'help', description: 'Muestra esta lista de comandos' },
                { name: 'ping', description: 'Verifica la latencia del bot' },
                { name: 'info', description: 'Información sobre el bot' },
            ],
            'Servidor Rust': [
                { name: 'server', description: 'Estado del servidor Rust' },
                { name: 'time', description: 'Hora actual en el servidor' },
                { name: 'team', description: 'Información del equipo' },
                { name: 'map', description: 'Eventos activos en el mapa' },
                { name: 'players', description: 'Jugadores conectados' },
            ],
            'Dispositivos': [
                { name: 'switch', description: 'Controlar switches inteligentes' },
                { name: 'devices', description: 'Ver dispositivos registrados' },
                { name: 'alarm', description: 'Gestionar alarmas' },
            ],
            'Administración': [
                { name: 'setchannel', description: 'Configurar canales del bot' },
                { name: 'settings', description: 'Configuración del bot' },
            ],
        };

        const embed = DiscordEmbeds.getHelpEmbed(commands);
        await client.interactionReply(interaction, { embeds: [embed] });
    },
};
