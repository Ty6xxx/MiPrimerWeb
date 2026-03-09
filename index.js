const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const RustPlusClient = require('./src/rustplus-client');
const { registerCommands } = require('./src/commands/register-commands');
const { handleInteraction, setBotState: setHandlerState } = require('./src/commands/handle-commands');
const { handleTeamMessage, setBotState: setChatState } = require('./src/handlers/team-chat');
const { formatEventMessage, formatEventEndMessage, formatTeamChangeEmbed } = require('./src/handlers/events');
const { BotState } = require('./src/handlers/state');
const config = require('./src/config');

// --- Estado Global ---
const botState = new BotState();

// --- Discord Client ---
const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Rust+ Client ---
const rustClient = new RustPlusClient();

// Canal de notificaciones (primer canal de texto disponible)
let notificationChannel = null;

// Inyectar estado en los handlers
setHandlerState(botState);
setChatState(botState);
botState.setSendMessage((msg) => {
  if (!botState.isSilenced()) {
    rustClient.sendTeamMessage(msg);
  }
});

// ========================
// Discord Events
// ========================
discord.once('ready', async () => {
  console.log(`[Discord] Bot conectado como ${discord.user.tag}`);

  // Buscar canal de notificaciones
  const guild = discord.guilds.cache.first();
  if (guild) {
    // Buscar canal llamado "rust-bot" o "rust" o usar el primer canal de texto
    notificationChannel =
      guild.channels.cache.find(c => c.name === 'rust-bot' && c.type === ChannelType.GuildText) ||
      guild.channels.cache.find(c => c.name === 'rust' && c.type === ChannelType.GuildText) ||
      guild.channels.cache.find(c => c.type === ChannelType.GuildText);

    if (notificationChannel) {
      console.log(`[Discord] Canal de notificaciones: #${notificationChannel.name}`);
    }
  }

  // Registrar slash commands
  await registerCommands();

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
  console.log('[Rust+] Conectado al servidor');

  // Iniciar monitoreo de equipo
  startTeamMonitoring();
});

// Notificar eventos del juego
rustClient.on('gameEvent', (event) => {
  if (botState.isSilenced()) return;

  const message = formatEventMessage(event);

  // Team chat
  rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '').replace(/[^\x00-\x7F]/g, '')}`);

  // Discord
  if (notificationChannel) {
    notificationChannel.send(message);
  }
});

rustClient.on('gameEventEnd', (event) => {
  if (botState.isSilenced()) return;

  const message = formatEventEndMessage(event);

  rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '').replace(/[^\x00-\x7F]/g, '')}`);

  if (notificationChannel) {
    notificationChannel.send(message);
  }
});

// Manejar mensajes del team chat
rustClient.on('teamMessage', async (msg) => {
  const response = await handleTeamMessage(rustClient, msg);
  if (response) {
    rustClient.sendTeamMessage(response);
  }
});

// ========================
// Monitoreo de equipo (AFK, conexiones, muertes)
// ========================
let teamMonitorTimer = null;

function startTeamMonitoring() {
  // Polling cada 15 segundos para detectar cambios de equipo
  teamMonitorTimer = setInterval(async () => {
    try {
      const teamInfo = await rustClient.getTeamInfo();
      const changes = botState.updateTeamState(teamInfo.members);

      if (botState.isSilenced()) return;

      // Notificaciones en team chat
      const chatMessages = [];

      for (const name of changes.connected) {
        chatMessages.push(`[BOT] ${name} se conecto.`);
      }
      for (const name of changes.disconnected) {
        chatMessages.push(`[BOT] ${name} se desconecto.`);
      }
      for (const d of changes.died) {
        chatMessages.push(`[BOT] ${d.name} murio en (${Math.round(d.x)}, ${Math.round(d.y)}) | Muertes: ${d.deathCount}`);
      }
      for (const name of changes.afkStart) {
        chatMessages.push(`[BOT] ${name} esta AFK.`);
      }
      for (const name of changes.afkEnd) {
        chatMessages.push(`[BOT] ${name} volvio de AFK.`);
      }

      // Enviar mensajes de team chat (con delay para no spamear)
      for (let i = 0; i < chatMessages.length; i++) {
        setTimeout(() => {
          rustClient.sendTeamMessage(chatMessages[i]);
        }, i * 1500);
      }

      // Notificaciones en Discord
      if (notificationChannel) {
        const embeds = formatTeamChangeEmbed(changes);
        for (const embed of embeds) {
          notificationChannel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      // Silenciar errores de polling
    }
  }, 15000);
}

// ========================
// Iniciar Bot
// ========================
console.log('[Bot] Iniciando Rust+ Discord Bot...');
discord.login(config.discord.token);

// Manejo de errores globales
process.on('unhandledRejection', (err) => {
  console.error('[Bot] Error no manejado:', err);
});

// Limpieza al salir
process.on('SIGINT', () => {
  console.log('[Bot] Apagando...');
  if (teamMonitorTimer) clearInterval(teamMonitorTimer);
  rustClient.stopEventPolling();
  discord.destroy();
  process.exit(0);
});
