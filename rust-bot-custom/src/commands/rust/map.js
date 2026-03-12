/**
 * Comando: /map
 * Muestra eventos activos en el mapa del servidor
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS, GAME_EVENTS } = require('../../utils/constants');
const DiscordEmbeds = require('../../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('map')
        .setDescription('Muestra eventos activos en el mapa'),

    async execute(client, interaction) {
        await interaction.deferReply();

        if (!client.rustManager) {
            const embed = DiscordEmbeds.getErrorEmbed('Error', 'RustPlus no está configurado.');
            return await interaction.editReply({ embeds: [embed] });
        }

        const markers = await client.rustManager.getMapMarkers();

        const embed = new EmbedBuilder()
            .setTitle('Eventos del Mapa')
            .setColor(COLORS.INFO)
            .setTimestamp();

        if (!markers || markers.length === 0) {
            embed.setDescription('No hay eventos activos en el mapa.');
        } else {
            const markerTypes = {
                2: { name: 'Explosión', emoji: EMOJIS.ALARM },
                4: { name: 'Chinook', emoji: EMOJIS.CHINOOK },
                5: { name: 'Cargo Ship', emoji: EMOJIS.CARGO },
                6: { name: 'Crate', emoji: EMOJIS.STORAGE },
                8: { name: 'Patrol Heli', emoji: EMOJIS.HELI },
            };

            const eventLines = markers
                .filter(m => markerTypes[m.type])
                .map(m => {
                    const info = markerTypes[m.type];
                    return `${info.emoji} **${info.name}** - Pos: (${m.x?.toFixed(0)}, ${m.y?.toFixed(0)})`;
                });

            if (eventLines.length > 0) {
                embed.setDescription(eventLines.join('\n'));
            } else {
                embed.setDescription('No hay eventos notables activos.');
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
