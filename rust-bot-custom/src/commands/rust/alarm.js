/**
 * Comando: /alarm
 * Gestionar alarmas inteligentes del servidor
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS, ENTITY_TYPES } = require('../../utils/constants');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alarm')
        .setDescription('Gestionar alarmas inteligentes')
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Ver estado de una alarma')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('ID de la alarma')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lista todas las alarmas registradas')),

    async execute(client, interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await client.interactionReply(interaction, { embeds: [embed] });
        }

        switch (subcommand) {
            case 'status': {
                await interaction.deferReply();
                const id = interaction.options.getString('id');
                const info = await client.rustManager.getEntityInfo(id);

                if (!info) {
                    const embed = DiscordEmbeds.getErrorEmbed('Error', `Alarma ${id} no encontrada.`);
                    return await interaction.editReply({ embeds: [embed] });
                }

                const device = client.rustManager.smartDevices.get(id);
                const embed = DiscordEmbeds.getDeviceEmbed({
                    entityId: id,
                    name: device?.name || `Alarma ${id}`,
                    type: ENTITY_TYPES.ALARM,
                    isActive: info.value,
                });
                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'list': {
                const devices = client.rustManager.getRegisteredDevices();
                const alarms = devices.filter(d => d.type === ENTITY_TYPES.ALARM);

                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.ALARM} Alarmas Registradas`)
                    .setColor(COLORS.WARNING)
                    .setTimestamp();

                if (alarms.length === 0) {
                    embed.setDescription('No hay alarmas registradas.');
                } else {
                    const list = alarms.map(a =>
                        `${EMOJIS.ALARM} **${a.name}** (ID: ${a.entityId})`
                    ).join('\n');
                    embed.setDescription(list);
                }

                await client.interactionReply(interaction, { embeds: [embed] });
                break;
            }
        }
    },
};
