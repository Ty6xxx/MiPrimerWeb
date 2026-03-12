/**
 * Evento: interactionCreate
 * Maneja todas las interacciones de Discord (comandos, botones, menús, modales)
 * Inspirado en el interactionCreate de rustplusplus
 */

const logger = require('../utils/logger');
const DiscordEmbeds = require('../utils/embeds');
const buttonHandler = require('../handlers/buttonHandler');
const selectMenuHandler = require('../handlers/selectMenuHandler');
const modalHandler = require('../handlers/modalHandler');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(client, interaction) {
        // === Comandos Slash ===
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                logger.warn(`Comando no encontrado: ${interaction.commandName}`);
                return;
            }

            try {
                logger.info(`Comando ejecutado: /${interaction.commandName} por ${interaction.user.tag}`);
                await command.execute(client, interaction);
            } catch (error) {
                logger.error(`Error ejecutando /${interaction.commandName}: ${error.message}`);

                const errorEmbed = DiscordEmbeds.getErrorEmbed(
                    'Error',
                    'Hubo un error al ejecutar este comando. Inténtalo de nuevo.'
                );

                await client.interactionReply(interaction, { embeds: [errorEmbed] }, true);
            }
            return;
        }

        // === Botones ===
        if (interaction.isButton()) {
            try {
                await buttonHandler.handle(client, interaction);
            } catch (error) {
                logger.error(`Error en botón ${interaction.customId}: ${error.message}`);
                try { await interaction.deferUpdate(); } catch (e) { /* ignorar */ }
            }
            return;
        }

        // === Menús de Selección ===
        if (interaction.isStringSelectMenu()) {
            try {
                await selectMenuHandler.handle(client, interaction);
            } catch (error) {
                logger.error(`Error en menú ${interaction.customId}: ${error.message}`);
                try { await interaction.deferUpdate(); } catch (e) { /* ignorar */ }
            }
            return;
        }

        // === Modales ===
        if (interaction.isModalSubmit()) {
            try {
                await modalHandler.handle(client, interaction);
            } catch (error) {
                logger.error(`Error en modal ${interaction.customId}: ${error.message}`);
            }
            return;
        }

        // === Autocompletado ===
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                try {
                    await command.autocomplete(client, interaction);
                } catch (error) {
                    logger.error(`Error en autocompletado: ${error.message}`);
                }
            }
            return;
        }

        logger.warn(`Tipo de interacción no manejado: ${interaction.type}`);
    },
};
