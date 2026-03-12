/**
 * Handler de Modales
 * Procesa formularios modales enviados en Discord
 */

const logger = require('../utils/logger');
const DiscordEmbeds = require('../utils/embeds');

module.exports = {
    async handle(client, interaction) {
        const customId = interaction.customId;

        logger.info(`Modal enviado: ${customId} por ${interaction.user.tag}`);

        switch (customId) {
            case 'modal_add_device': {
                const entityId = interaction.fields.getTextInputValue('device_id');
                const deviceName = interaction.fields.getTextInputValue('device_name');
                const deviceType = parseInt(interaction.fields.getTextInputValue('device_type')) || 1;

                if (client.rustManager) {
                    client.rustManager.registerDevice(entityId, deviceName, deviceType);
                    const embed = DiscordEmbeds.getSuccessEmbed(
                        'Dispositivo Agregado',
                        `**${deviceName}** (ID: ${entityId}) registrado exitosamente.`
                    );
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
                break;
            }

            case 'modal_send_message': {
                const message = interaction.fields.getTextInputValue('team_message');
                if (client.rustManager && client.rustManager.isConnected) {
                    await client.rustManager.sendTeamMessage(
                        `[Discord] ${interaction.user.username}: ${message}`
                    );
                    const embed = DiscordEmbeds.getSuccessEmbed(
                        'Mensaje Enviado',
                        `Tu mensaje fue enviado al chat del equipo.`
                    );
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    const embed = DiscordEmbeds.getErrorEmbed(
                        'Error',
                        'No hay conexión con el servidor.'
                    );
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                }
                break;
            }

            default:
                logger.warn(`Modal no reconocido: ${customId}`);
                await interaction.reply({
                    content: 'Formulario procesado.',
                    ephemeral: true,
                });
                break;
        }
    },
};
