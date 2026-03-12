/**
 * Comando: /devices
 * Gestionar dispositivos inteligentes registrados
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS, ENTITY_TYPES } = require('../../utils/constants');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('devices')
        .setDescription('Gestionar dispositivos inteligentes')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Lista todos los dispositivos registrados'))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Registrar un nuevo dispositivo')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('ID del dispositivo')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('nombre')
                        .setDescription('Nombre descriptivo')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('tipo')
                        .setDescription('Tipo de dispositivo')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Switch', value: '1' },
                            { name: 'Alarma', value: '2' },
                            { name: 'Monitor de Almacenamiento', value: '3' }
                        )))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Eliminar un dispositivo registrado')
                .addStringOption(opt =>
                    opt.setName('id')
                        .setDescription('ID del dispositivo a eliminar')
                        .setRequired(true))),

    async execute(client, interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await client.interactionReply(interaction, { embeds: [embed] });
        }

        switch (subcommand) {
            case 'list': {
                const devices = client.rustManager.getRegisteredDevices();
                const typeNames = { 1: 'Switch', 2: 'Alarma', 3: 'Storage Monitor' };

                const embed = new EmbedBuilder()
                    .setTitle(`${EMOJIS.SWITCH} Dispositivos Registrados`)
                    .setColor(COLORS.INFO)
                    .setTimestamp();

                if (devices.length === 0) {
                    embed.setDescription('No hay dispositivos registrados.\nUsa `/devices add` para agregar uno.');
                } else {
                    const list = devices.map(d =>
                        `${EMOJIS.ON} **${d.name}** (ID: ${d.entityId}) - ${typeNames[d.type] || 'Desconocido'}`
                    ).join('\n');
                    embed.setDescription(list);
                    embed.setFooter({ text: `${devices.length} dispositivo(s) registrado(s)` });
                }

                await client.interactionReply(interaction, { embeds: [embed] });
                break;
            }

            case 'add': {
                const id = interaction.options.getString('id');
                const name = interaction.options.getString('nombre');
                const type = parseInt(interaction.options.getString('tipo'));

                client.rustManager.registerDevice(id, name, type);

                const embed = DiscordEmbeds.getSuccessEmbed(
                    'Dispositivo Registrado',
                    `**${name}** (ID: ${id}) ha sido registrado exitosamente.`
                );
                await client.interactionReply(interaction, { embeds: [embed] });
                break;
            }

            case 'remove': {
                const id = interaction.options.getString('id');
                const device = client.rustManager.smartDevices.get(id);

                if (!device) {
                    const embed = DiscordEmbeds.getErrorEmbed('Error', `No se encontró dispositivo con ID: ${id}`);
                    return await client.interactionReply(interaction, { embeds: [embed] });
                }

                client.rustManager.unregisterDevice(id);

                const embed = DiscordEmbeds.getSuccessEmbed(
                    'Dispositivo Eliminado',
                    `**${device.name}** (ID: ${id}) ha sido eliminado.`
                );
                await client.interactionReply(interaction, { embeds: [embed] });
                break;
            }
        }
    },
};
