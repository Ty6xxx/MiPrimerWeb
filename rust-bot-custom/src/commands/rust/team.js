/**
 * Comando: /team
 * Muestra información del equipo en el servidor
 */

const { SlashCommandBuilder } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Muestra información del equipo'),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const teamInfo = await client.rustManager.getTeamInfo();

        if (!teamInfo) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'No se pudo obtener información del equipo.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = DiscordEmbeds.getTeamInfoEmbed(teamInfo);
        await interaction.editReply({ embeds: [embed] });
    },
};
