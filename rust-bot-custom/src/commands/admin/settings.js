/**
 * Comando: /settings
 * Muestra y gestiona la configuración actual del bot
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { COLORS, EMOJIS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Ver configuración actual del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(client, interaction) {
        const config = client.config;
        const rustManager = client.rustManager;

        const embed = new EmbedBuilder()
            .setTitle('Configuración del Bot')
            .setColor(COLORS.DEFAULT)
            .addFields(
                {
                    name: 'Conexión Rust+',
                    value: rustManager?.isConnected
                        ? `${EMOJIS.ONLINE} Conectado`
                        : `${EMOJIS.OFFLINE} Desconectado`,
                    inline: true,
                },
                {
                    name: 'Canal de Notificaciones',
                    value: config.notificationChannelId
                        ? `<#${config.notificationChannelId}>`
                        : 'No configurado',
                    inline: true,
                },
                {
                    name: 'Canal de Team Chat',
                    value: config.commandChannelId
                        ? `<#${config.commandChannelId}>`
                        : 'No configurado',
                    inline: true,
                },
                {
                    name: 'Dispositivos Registrados',
                    value: String(rustManager?.smartDevices?.size || 0),
                    inline: true,
                },
                {
                    name: 'Servidor',
                    value: rustManager?.serverInfo?.name || 'Desconocido',
                    inline: true,
                }
            )
            .setTimestamp();

        await client.interactionReply(interaction, { embeds: [embed] });
    },
};
