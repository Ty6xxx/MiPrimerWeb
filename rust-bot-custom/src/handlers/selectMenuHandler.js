/**
 * Handler de Menús de Selección
 * Procesa interacciones de select menus en Discord
 */

const logger = require('../utils/logger');
const DiscordEmbeds = require('../utils/embeds');

module.exports = {
    async handle(client, interaction) {
        const customId = interaction.customId;
        const selectedValues = interaction.values;

        logger.info(`Menú seleccionado: ${customId} - Valores: ${selectedValues.join(', ')}`);

        switch (customId) {
            case 'select_device': {
                const entityId = selectedValues[0];
                if (client.rustManager) {
                    const info = await client.rustManager.getEntityInfo(entityId);
                    const device = client.rustManager.smartDevices.get(entityId);
                    if (info) {
                        const embed = DiscordEmbeds.getDeviceEmbed({
                            entityId,
                            name: device?.name || `Dispositivo ${entityId}`,
                            type: info.type || 1,
                            isActive: info.value,
                        });
                        await interaction.update({ embeds: [embed] });
                    }
                }
                break;
            }

            case 'select_event_type': {
                const eventType = selectedValues[0];
                logger.info(`Filtro de evento seleccionado: ${eventType}`);
                await interaction.deferUpdate();
                break;
            }

            default:
                logger.warn(`Menú no reconocido: ${customId}`);
                await interaction.deferUpdate();
                break;
        }
    },
};
