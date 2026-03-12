/**
 * Comando: /time
 * Muestra la hora actual en el servidor Rust
 */

const { SlashCommandBuilder } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('Muestra la hora actual en el servidor'),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const timeInfo = await client.rustManager.getTime();

        if (!timeInfo) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'No se pudo obtener el tiempo del servidor.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = DiscordEmbeds.getTimeEmbed(timeInfo);
        await interaction.editReply({ embeds: [embed] });
    },
};
