/**
 * Módulo de Embeds de Discord
 * Genera embeds formateados para diferentes tipos de mensajes
 * Inspirado en discordEmbeds de rustplusplus
 */

const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('./constants');

class DiscordEmbeds {
    /**
     * Embed genérico de información
     */
    static getInfoEmbed(title, description, color = COLORS.INFO) {
        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();
    }

    /**
     * Embed de éxito
     */
    static getSuccessEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.ON} ${title}`)
            .setDescription(description)
            .setColor(COLORS.SUCCESS)
            .setTimestamp();
    }

    /**
     * Embed de error
     */
    static getErrorEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.OFF} ${title}`)
            .setDescription(description)
            .setColor(COLORS.ERROR)
            .setTimestamp();
    }

    /**
     * Embed de advertencia
     */
    static getWarningEmbed(title, description) {
        return new EmbedBuilder()
            .setTitle(`${EMOJIS.ALARM} ${title}`)
            .setDescription(description)
            .setColor(COLORS.WARNING)
            .setTimestamp();
    }

    /**
     * Embed de estado del servidor
     */
    static getServerStatusEmbed(serverInfo) {
        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.ONLINE} Estado del Servidor`)
            .setColor(serverInfo.online ? COLORS.ONLINE : COLORS.OFFLINE)
            .setTimestamp();

        if (serverInfo.name) embed.addFields({ name: 'Servidor', value: serverInfo.name, inline: true });
        if (serverInfo.players !== undefined) {
            embed.addFields({
                name: 'Jugadores',
                value: `${serverInfo.players}/${serverInfo.maxPlayers || '?'}`,
                inline: true,
            });
        }
        if (serverInfo.map) embed.addFields({ name: 'Mapa', value: serverInfo.map, inline: true });
        if (serverInfo.seed) embed.addFields({ name: 'Seed', value: String(serverInfo.seed), inline: true });
        if (serverInfo.size) embed.addFields({ name: 'Tamaño', value: String(serverInfo.size), inline: true });

        return embed;
    }

    /**
     * Embed de tiempo del juego
     */
    static getTimeEmbed(timeInfo) {
        const isDay = timeInfo.time >= 6.0 && timeInfo.time < 18.0;
        const emoji = isDay ? EMOJIS.DAY : EMOJIS.NIGHT;
        const period = isDay ? 'Día' : 'Noche';

        return new EmbedBuilder()
            .setTitle(`${emoji} Tiempo en el Servidor`)
            .setDescription(`**Hora actual:** ${timeInfo.time.toFixed(2)}\n**Período:** ${period}`)
            .setColor(isDay ? COLORS.WARNING : COLORS.INFO)
            .setTimestamp();
    }

    /**
     * Embed de evento del mapa
     */
    static getEventEmbed(eventType, eventData) {
        const eventConfig = {
            cargoShip: { title: 'Cargo Ship', emoji: EMOJIS.CARGO, color: COLORS.CARGO_SHIP },
            patrolHelicopter: { title: 'Patrol Helicopter', emoji: EMOJIS.HELI, color: COLORS.PATROL_HELI },
            ch47: { title: 'Chinook CH-47', emoji: EMOJIS.CHINOOK, color: COLORS.CHINOOK },
            bradleyApc: { title: 'Bradley APC', emoji: EMOJIS.BRADLEY, color: COLORS.BRADLEY },
            oilRigSmall: { title: 'Small Oil Rig', emoji: EMOJIS.OIL_RIG, color: COLORS.OIL_RIG },
            oilRigLarge: { title: 'Large Oil Rig', emoji: EMOJIS.OIL_RIG, color: COLORS.OIL_RIG },
        };

        const config = eventConfig[eventType] || { title: 'Evento', emoji: '', color: COLORS.DEFAULT };

        const embed = new EmbedBuilder()
            .setTitle(`${config.emoji} ${config.title} Detectado`)
            .setColor(config.color)
            .setTimestamp();

        if (eventData && eventData.x !== undefined) {
            embed.addFields({
                name: 'Ubicación',
                value: `X: ${eventData.x.toFixed(0)}, Y: ${eventData.y.toFixed(0)}`,
                inline: true,
            });
        }

        return embed;
    }

    /**
     * Embed de información de equipo
     */
    static getTeamInfoEmbed(teamMembers) {
        const embed = new EmbedBuilder()
            .setTitle('Información del Equipo')
            .setColor(COLORS.INFO)
            .setTimestamp();

        if (!teamMembers || teamMembers.length === 0) {
            embed.setDescription('No hay miembros en el equipo.');
            return embed;
        }

        const memberList = teamMembers.map(member => {
            const status = member.isOnline
                ? EMOJIS.ONLINE
                : member.isAlive ? EMOJIS.OFFLINE : ':skull:';
            return `${status} **${member.name}** ${member.isLeader ? '(Líder)' : ''}`;
        });

        embed.setDescription(memberList.join('\n'));
        embed.addFields({ name: 'Total', value: `${teamMembers.length} miembros`, inline: true });

        return embed;
    }

    /**
     * Embed de dispositivo inteligente (switch/alarma/monitor)
     */
    static getDeviceEmbed(device) {
        const typeNames = { 1: 'Switch', 2: 'Alarma', 3: 'Monitor de Almacenamiento' };
        const typeName = typeNames[device.type] || 'Dispositivo';

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.SWITCH} ${typeName}: ${device.name || 'Sin nombre'}`)
            .setColor(device.isActive ? COLORS.SUCCESS : COLORS.ERROR)
            .addFields(
                { name: 'Estado', value: device.isActive ? 'Encendido' : 'Apagado', inline: true },
                { name: 'ID', value: String(device.entityId), inline: true }
            )
            .setTimestamp();

        return embed;
    }

    /**
     * Embed de ayuda con lista de comandos
     */
    static getHelpEmbed(commands) {
        const embed = new EmbedBuilder()
            .setTitle('Comandos Disponibles')
            .setDescription('Lista de todos los comandos del bot para gestión de servidores Rust.')
            .setColor(COLORS.DEFAULT)
            .setTimestamp();

        for (const [category, cmds] of Object.entries(commands)) {
            const cmdList = cmds.map(c => `\`/${c.name}\` - ${c.description}`).join('\n');
            embed.addFields({ name: category, value: cmdList || 'Sin comandos' });
        }

        return embed;
    }
}

module.exports = DiscordEmbeds;
