/**
 * Handler de Botones
 * Procesa interacciones de botones en Discord
 * Inspirado en buttonHandler de rustplusplus
 */

const logger = require('../utils/logger');
const DiscordEmbeds = require('../utils/embeds');

// Mapeo de acciones de botones
const buttonActions = {
    // Switches
    'switch_on': async (client, interaction, entityId) => {
        const success = await client.rustManager.toggleSmartSwitch(entityId, true);
        if (success) {
            await interaction.update({
                embeds: [DiscordEmbeds.getSuccessEmbed('Switch', `Switch ${entityId} encendido`)],
            });
        }
    },

    'switch_off': async (client, interaction, entityId) => {
        const success = await client.rustManager.toggleSmartSwitch(entityId, false);
        if (success) {
            await interaction.update({
                embeds: [DiscordEmbeds.getSuccessEmbed('Switch', `Switch ${entityId} apagado`)],
            });
        }
    },

    // Refrescar información
    'refresh_server': async (client, interaction) => {
        const info = await client.rustManager.getServerInfo();
        if (info) {
            await interaction.update({
                embeds: [DiscordEmbeds.getServerStatusEmbed(info)],
            });
        }
    },

    'refresh_team': async (client, interaction) => {
        const team = await client.rustManager.getTeamInfo();
        if (team) {
            await interaction.update({
                embeds: [DiscordEmbeds.getTeamInfoEmbed(team)],
            });
        }
    },
};

module.exports = {
    async handle(client, interaction) {
        const customId = interaction.customId;
        const [action, ...params] = customId.split('_');
        const fullAction = params.length > 1 ? `${action}_${params[0]}` : customId;
        const entityId = params[params.length - 1];

        logger.info(`Botón presionado: ${customId} por ${interaction.user.tag}`);

        const handler = buttonActions[fullAction] || buttonActions[customId];

        if (handler) {
            await handler(client, interaction, entityId);
        } else {
            logger.warn(`Acción de botón no reconocida: ${customId}`);
            await interaction.deferUpdate();
        }
    },
};
