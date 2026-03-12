/**
 * Comando: /setchannel
 * Configurar canales de notificaciones y comandos
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Configurar canales del bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName('tipo')
                .setDescription('Tipo de canal a configurar')
                .setRequired(true)
                .addChoices(
                    { name: 'Notificaciones', value: 'notifications' },
                    { name: 'Comandos / Team Chat', value: 'commands' }
                ))
        .addChannelOption(opt =>
            opt.setName('canal')
                .setDescription('Canal a usar')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),

    async execute(client, interaction) {
        const type = interaction.options.getString('tipo');
        const channel = interaction.options.getChannel('canal');

        if (type === 'notifications') {
            client.setNotificationChannel(channel.id);
            const embed = DiscordEmbeds.getSuccessEmbed(
                'Canal Configurado',
                `Canal de notificaciones establecido en <#${channel.id}>`
            );
            await client.interactionReply(interaction, { embeds: [embed] });
        } else {
            client.setCommandChannel(channel.id);
            const embed = DiscordEmbeds.getSuccessEmbed(
                'Canal Configurado',
                `Canal de team chat establecido en <#${channel.id}>`
            );
            await client.interactionReply(interaction, { embeds: [embed] });
        }
    },
};
