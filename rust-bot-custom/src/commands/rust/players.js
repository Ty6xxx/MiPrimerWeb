/**
 * Comando: /players
 * Muestra los jugadores conectados al servidor
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../../utils/constants');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('players')
        .setDescription('Muestra los jugadores conectados'),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const serverInfo = await client.rustManager.getServerInfo();
        const teamInfo = await client.rustManager.getTeamInfo();

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.ONLINE} Jugadores en el Servidor`)
            .setColor(COLORS.INFO)
            .setTimestamp();

        if (serverInfo) {
            embed.addFields({
                name: 'Servidor',
                value: `${serverInfo.players}/${serverInfo.maxPlayers} jugadores`,
            });
        }

        if (teamInfo && teamInfo.length > 0) {
            const online = teamInfo.filter(m => m.isOnline);
            const offline = teamInfo.filter(m => !m.isOnline);

            if (online.length > 0) {
                embed.addFields({
                    name: `${EMOJIS.ONLINE} En línea (${online.length})`,
                    value: online.map(m => `• **${m.name}**`).join('\n'),
                });
            }

            if (offline.length > 0) {
                embed.addFields({
                    name: `${EMOJIS.OFFLINE} Desconectados (${offline.length})`,
                    value: offline.map(m => `• ${m.name}`).join('\n'),
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
