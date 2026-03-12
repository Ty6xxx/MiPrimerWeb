/**
 * Comando: /server
 * Muestra el estado actual del servidor Rust
 */

const { SlashCommandBuilder } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Muestra el estado del servidor Rust'),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const serverInfo = await client.rustManager.getServerInfo();

        if (!serverInfo) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'No se pudo obtener información del servidor.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = DiscordEmbeds.getServerStatusEmbed(serverInfo);
        await interaction.editReply({ embeds: [embed] });
    },
};
