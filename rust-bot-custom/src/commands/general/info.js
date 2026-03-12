/**
 * Comando: /info
 * Muestra información general sobre el bot
 */

const { SlashCommandBuilder, EmbedBuilder, version: djsVersion } = require('discord.js');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Información sobre el bot'),

    async execute(client, interaction) {
        const uptime = formatUptime(client.uptime);

        const embed = new EmbedBuilder()
            .setTitle('Rust Bot Custom')
            .setDescription('Bot de Discord para gestión de servidores Rust.\nInspirado en [rustplusplus](https://github.com/alexemanuelol/rustplusplus).')
            .setColor(COLORS.DEFAULT)
            .addFields(
                { name: 'Versión', value: '1.0.0', inline: true },
                { name: 'Discord.js', value: djsVersion, inline: true },
                { name: 'Node.js', value: process.version, inline: true },
                { name: 'Uptime', value: uptime, inline: true },
                { name: 'Servidores', value: String(client.guilds.cache.size), inline: true },
                { name: 'Comandos', value: String(client.commands.size), inline: true },
                {
                    name: 'Rust+',
                    value: client.rustManager?.isConnected ? 'Conectado' : 'Desconectado',
                    inline: true,
                }
            )
            .setTimestamp();

        await client.interactionReply(interaction, { embeds: [embed] });
    },
};

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}
