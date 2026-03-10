const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ========================
// Verificar si el .env tiene datos reales de Rust+
// ========================
function hasValidRustConfig() {
  const { RUST_SERVER_IP, RUST_SERVER_PORT, RUST_PLAYER_ID, RUST_PLAYER_TOKEN } = process.env;
  // Verificar que existan y no sean placeholders
  if (!RUST_SERVER_IP || !RUST_SERVER_PORT || !RUST_PLAYER_ID || !RUST_PLAYER_TOKEN) return false;
  if (RUST_SERVER_IP.includes('tu_') || RUST_SERVER_PORT.includes('tu_')) return false;
  if (RUST_PLAYER_ID.includes('tu_') || RUST_PLAYER_TOKEN.includes('tu_')) return false;
  return true;
}

if (!hasValidRustConfig()) {
  console.log('[Bot] Faltan datos de Rust+ en .env. Iniciando setup...\n');
  // Ejecutar setup.js
  require('./setup');
} else {
  startBot();
}

// ========================
// Bot Principal
// ========================
function startBot() {
  const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
  const RustPlusClient = require('./src/rustplus-client');
  const { registerCommands } = require('./src/commands/register-commands');
  const { handleInteraction, setBotState: setHandlerState } = require('./src/commands/handle-commands');
  const { handleTeamMessage, setBotState: setChatState } = require('./src/handlers/team-chat');
  const { formatEventMessage, formatEventEndMessage, formatTeamChangeEmbed } = require('./src/handlers/events');
  const { BotState } = require('./src/handlers/state');
  const config = require('./src/config');

  if (!config.discord.token) {
    console.log('[Bot] ERROR: DISCORD_TOKEN no configurado en .env');
    return;
  }

  console.log('[Bot] Iniciando Rust+ Discord Bot...');
  console.log(`[Bot] Servidor: ${config.rust.serverIp}:${config.rust.serverPort}`);

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

  // Canal de notificaciones
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
  discord.once('clientReady', async () => {
    console.log(`[Discord] Bot conectado como ${discord.user.tag}`);

    const guild = discord.guilds.cache.first();
    if (guild) {
      notificationChannel =
        guild.channels.cache.find(c => c.name === 'rust-bot' && c.type === ChannelType.GuildText) ||
        guild.channels.cache.find(c => c.name === 'rust' && c.type === ChannelType.GuildText) ||
        guild.channels.cache.find(c => c.type === ChannelType.GuildText);

      if (notificationChannel) {
        console.log(`[Discord] Canal de notificaciones: #${notificationChannel.name}`);
      }
    }

    await registerCommands();
    rustClient.connect();
  });

  discord.on('interactionCreate', (interaction) => {
    handleInteraction(interaction, rustClient);
  });

  // ========================
  // Rust+ Events
  // ========================
  let teamMonitorTimer = null;

  rustClient.on('ready', async () => {
    console.log('[Rust+] Conectado al servidor');

    teamMonitorTimer = setInterval(async () => {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const changes = botState.updateTeamState(teamInfo.members);

        if (botState.isSilenced()) return;

        const chatMessages = [];
        for (const name of changes.connected) chatMessages.push(`[BOT] ${name} se conecto.`);
        for (const name of changes.disconnected) chatMessages.push(`[BOT] ${name} se desconecto.`);
        for (const d of changes.died) chatMessages.push(`[BOT] ${d.name} murio en (${Math.round(d.x)}, ${Math.round(d.y)}) | Muertes: ${d.deathCount}`);
        for (const name of changes.afkStart) chatMessages.push(`[BOT] ${name} esta AFK.`);
        for (const name of changes.afkEnd) chatMessages.push(`[BOT] ${name} volvio de AFK.`);

        for (let i = 0; i < chatMessages.length; i++) {
          setTimeout(() => rustClient.sendTeamMessage(chatMessages[i]), i * 1500);
        }

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
  });

  rustClient.on('gameEvent', (event) => {
    if (botState.isSilenced()) return;
    const message = formatEventMessage(event);
    rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '').replace(/[^\x00-\x7F]/g, '')}`);
    if (notificationChannel) notificationChannel.send(message);
  });

  rustClient.on('gameEventEnd', (event) => {
    if (botState.isSilenced()) return;
    const message = formatEventEndMessage(event);
    rustClient.sendTeamMessage(`[BOT] ${message.replace(/\*\*/g, '').replace(/[^\x00-\x7F]/g, '')}`);
    if (notificationChannel) notificationChannel.send(message);
  });

  rustClient.on('teamMessage', async (msg) => {
    const response = await handleTeamMessage(rustClient, msg);
    if (response) rustClient.sendTeamMessage(response);
  });

  // Iniciar Discord
  discord.login(config.discord.token);

  process.on('unhandledRejection', (err) => {
    console.error('[Bot] Error no manejado:', err);
  });

  process.on('SIGINT', () => {
    console.log('[Bot] Apagando...');
    if (teamMonitorTimer) clearInterval(teamMonitorTimer);
    rustClient.stopEventPolling();
    discord.destroy();
    process.exit(0);
  });
}
