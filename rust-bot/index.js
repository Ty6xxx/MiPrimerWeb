const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const RustPlusClient = require('./src/rustplus-client');
const { registerCommands } = require('./src/commands/register-commands');
const { handleInteraction } = require('./src/commands/handle-commands');
const { handleTeamMessage } = require('./src/handlers/team-chat');
const {
  formatEventMessage,
  formatEventEndMessage,
} = require('./src/handlers/events');
const config = require('./src/config');

// --- Discord Client ---
const discord = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Rust+ Client ---
const rustClient = new RustPlusClient();

// Canal de Discord para notificaciones
let notificationChannel = null;

// ========================
// Discord Events
// ========================
discord.once('ready', async () => {
  console.log(`[Discord] Bot conectado como ${discord.user.tag}`);

  // Registrar slash commands
  await registerCommands();

  // Obtener canal de notificaciones
  if (config.discord.channelId) {
    notificationChannel = await discord.channels
      .fetch(config.discord.channelId)
      .catch(() => null);
    if (notificationChannel) {
      console.log(
        `[Discord] Canal de notificaciones: #${notificationChannel.name}`
      );
    }
  }

  // Conectar a Rust+ despues de Discord
  rustClient.connect();
});

discord.on('interactionCreate', (interaction) => {
  handleInteraction(interaction, rustClient);
});

// ========================
// Rust+ Events
// ========================
rustClient.on('ready', async () => {
  if (notificationChannel) {
    try {
      const info = await rustClient.getServerInfo();
      const embed = new EmbedBuilder()
        .setTitle('Bot Conectado a Rust+')
        .setColor(0x00ff00)
        .addFields(
          { name: 'Servidor', value: info.name, inline: false },
          {
            name: 'Jugadores',
            value: `${info.players}/${info.maxPlayers}`,
            inline: true,
          },
          { name: 'Mapa', value: `${info.map} (${info.mapSize})`, inline: true }
        )
        .setTimestamp();
      notificationChannel.send({ embeds: [embed] });
    } catch {
      notificationChannel.send('Bot conectado a Rust+');
    }
  }
});

// Notificar eventos del juego en Discord
rustClient.on('gameEvent', (event) => {
  const message = formatEventMessage(event);

  // Notificar en Discord
  if (notificationChannel) {
    const embed = new EmbedBuilder()
      .setTitle('Evento Detectado')
      .setDescription(message)
      .setColor(0xff6600)
      .setTimestamp();

    if (event.marker) {
      embed.addFields({
        name: 'Coordenadas',
        value: `X: ${Math.round(event.marker.x)}, Y: ${Math.round(event.marker.y)}`,
        inline: true,
      });
    }

    notificationChannel.send({ embeds: [embed] });
  }

  // Notificar en team chat
  rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '')}`);
});

rustClient.on('gameEventEnd', (event) => {
  const message = formatEventEndMessage(event);
  if (notificationChannel) {
    notificationChannel.send(message);
  }
});

// Manejar cambios de entidades
rustClient.on('entityChanged', (data) => {
  if (notificationChannel) {
    const state = data.value ? 'ENCENDIDO' : 'APAGADO';
    notificationChannel.send(
      `Smart Device **${data.entityId}** cambio a: **${state}**`
    );
  }
});

// Manejar mensajes del team chat
rustClient.on('teamMessage', async (msg) => {
  // Reenviar team chat a Discord
  if (notificationChannel) {
    notificationChannel.send(`**[Rust Chat] ${msg.name}:** ${msg.message}`);
  }

  // Procesar comandos del team chat
  const response = await handleTeamMessage(rustClient, msg);
  if (response) {
    rustClient.sendTeamMessage(response);
  }
});

// ========================
// Iniciar Bot
// ========================
console.log('[Bot] Iniciando Rust+ Discord Bot...');
discord.login(config.discord.token);

// Manejo de errores globales
process.on('unhandledRejection', (err) => {
  console.error('[Bot] Error no manejado:', err);
});
