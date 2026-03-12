/**
 * Comando: /switch
 * Controlar switches inteligentes en el servidor Rust
 */

const { SlashCommandBuilder } = require('discord.js');
const DiscordEmbeds = require('../../utils/embeds');
const { ENTITY_TYPES } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('switch')
        .setDescription('Controlar un switch inteligente')
        .addStringOption(opt =>
            opt.setName('accion')
                .setDescription('Acción a realizar')
                .setRequired(true)
                .addChoices(
                    { name: 'Encender', value: 'on' },
                    { name: 'Apagar', value: 'off' },
                    { name: 'Estado', value: 'status' }
                ))
        .addStringOption(opt =>
            opt.setName('id')
                .setDescription('ID del switch o nombre registrado')
                .setRequired(true)),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager || !client.rustManager.isConnected) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'No hay conexión con el servidor Rust.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const action = interaction.options.getString('accion');
        const entityId = interaction.options.getString('id');

        if (action === 'status') {
            const info = await client.rustManager.getEntityInfo(entityId);
            if (!info) {
                const embed = DiscordEmbeds.getErrorEmbed('Error', `No se encontró el dispositivo ${entityId}.`);
                return await interaction.editReply({ embeds: [embed] });
            }

            const device = client.rustManager.smartDevices.get(entityId);
            const embed = DiscordEmbeds.getDeviceEmbed({
                entityId,
                name: device?.name || `Switch ${entityId}`,
                type: ENTITY_TYPES.SWITCH,
                isActive: info.value,
            });
            return await interaction.editReply({ embeds: [embed] });
        }

        // Encender o apagar
        const value = action === 'on';
        const success = await client.rustManager.toggleSmartSwitch(entityId, value);

        if (success) {
            const embed = DiscordEmbeds.getSuccessEmbed(
                'Switch Controlado',
                `Switch **${entityId}** ${value ? 'encendido' : 'apagado'} exitosamente.`
            );
            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = DiscordEmbeds.getErrorEmbed(
                'Error',
                `No se pudo ${value ? 'encender' : 'apagar'} el switch ${entityId}.`
            );
            await interaction.editReply({ embeds: [embed] });
        }
    },
};
