/**
 * Comando: /ping
 * Verifica la latencia del bot y la conexión con el servidor
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Verifica la latencia del bot'),

    async execute(client, interaction) {
        const sent = await interaction.reply({ content: 'Calculando...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        const rustStatus = client.rustManager?.isConnected ? 'Conectado' : 'Desconectado';

        const embed = new EmbedBuilder()
            .setTitle('Pong!')
            .setColor(COLORS.SUCCESS)
            .addFields(
                { name: 'Latencia del Bot', value: `${latency}ms`, inline: true },
                { name: 'Latencia API', value: `${apiLatency}ms`, inline: true },
                { name: 'Rust+', value: rustStatus, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ content: null, embeds: [embed] });
    },
};
