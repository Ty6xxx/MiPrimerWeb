const path = require('path');
const fs = require('fs');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

require('dotenv').config();

const rustplusConfigPath = path.join(__dirname, 'rustplus.config.json');

// ========================
// Verificar si el .env ya tiene datos validos de Rust+
// ========================
function hasValidRustConfig() {
  const { RUST_SERVER_IP, RUST_SERVER_PORT, RUST_PLAYER_ID, RUST_PLAYER_TOKEN } = process.env;
  if (!RUST_SERVER_IP || !RUST_SERVER_PORT || !RUST_PLAYER_ID || !RUST_PLAYER_TOKEN) return false;
  if (RUST_SERVER_IP.includes('tu_') || RUST_SERVER_PORT.includes('tu_')) return false;
  if (RUST_PLAYER_ID.includes('tu_') || RUST_PLAYER_TOKEN.includes('tu_')) return false;
  return true;
}

if (hasValidRustConfig()) {
  console.log('[Bot] Datos de Rust+ encontrados en .env\n');
  startBot();
} else {
  console.log('[Bot] Faltan datos de Rust+ en .env, iniciando pairing...\n');
  startPairing();
}

// ========================
// MODO PAIRING
// ========================
async function startPairing() {
  if (!fs.existsSync(rustplusConfigPath)) {
    console.log('============================================');
    console.log('  CONFIGURACION INICIAL');
    console.log('============================================');
    console.log('');
    console.log('1. Ejecuta: npx @liamcottle/rustplus.js fcm-register');
    console.log('2. Coloca rustplus.config.json en esta carpeta');
    console.log('3. Vuelve a ejecutar: npm start');
    console.log('============================================\n');
    return;
  }

  let rustPlusConfig;
  try {
    rustPlusConfig = JSON.parse(fs.readFileSync(rustplusConfigPath, 'utf-8'));
  } catch (err) {
    console.log('[Pairing] ERROR: rustplus.config.json corrupto o ilegible:', err.message);
    return;
  }
  if (!rustPlusConfig.fcm_credentials) {
    console.log('[Pairing] ERROR: fcm_credentials no encontrado. Regenera rustplus.config.json.');
    return;
  }

  const creds = rustPlusConfig.fcm_credentials;
  if (!creds.gcm) {
    console.log('[Pairing] ERROR: gcm no encontrado en fcm_credentials. Regenera rustplus.config.json.');
    return;
  }
  const androidId = (creds.gcm.android_id || creds.gcm.androidId || '').toString();
  const securityToken = (creds.gcm.security_token || creds.gcm.securityToken || '').toString();

  if (!androidId || !securityToken) {
    console.log('[Pairing] ERROR: Credenciales FCM invalidas.');
    return;
  }

  console.log('[Pairing] FCM credentials OK');

  const pushClient = new PushReceiverClient(androidId, securityToken, []);

  pushClient.on('ON_DATA_RECEIVED', (data) => {
    const appData = data.appData;
    if (!appData) return;

    const channelId = appData.find(item => item.key === 'channelId')?.value;
    const title = appData.find(item => item.key === 'title')?.value;
    const bodyCheck = appData.find(item => item.key === 'body');

    console.log('[Pairing] channelId:', channelId, '| title:', title);

    if (channelId !== 'pairing' || !bodyCheck) return;

    const body = JSON.parse(bodyCheck.value);

    if (body.ip && body.port && body.playerId && body.playerToken) {
      console.log(`[Pairing] EXITOSO! Servidor: ${title || body.name}`);
      console.log(`[Pairing] IP: ${body.ip} Puerto: ${body.port}`);
      console.log(`[Pairing] PlayerID: ${body.playerId}`);

      // Guardar en .env
      const envPath = path.join(__dirname, '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      const rustVars = {
        RUST_SERVER_IP: body.ip,
        RUST_SERVER_PORT: body.port.toString(),
        RUST_PLAYER_ID: body.playerId.toString(),
        RUST_PLAYER_TOKEN: body.playerToken.toString(),
      };

      for (const [key, value] of Object.entries(rustVars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
      console.log('[Pairing] Datos guardados en .env\n');

      // Destruir listener
      pushClient.destroy();

      // Setear en process.env para que config.js los lea
      Object.assign(process.env, rustVars);

      // Arrancar bot
      startBot();
    }
  });

  try {
    await pushClient.connect();
  } catch (err) {
    console.log('[Pairing] ERROR al conectar FCM:', err.message);
    console.log('[Pairing] Verifica tu rustplus.config.json y tu conexion a internet.');
    return;
  }

  console.log('============================================');
  console.log('  MODO PAIRING ACTIVO');
  console.log('============================================');
  console.log('');
  console.log('Entra al servidor de Rust y presiona');
  console.log('"PAIR WITH SERVER" en el menu de Rust+');
  console.log('');
  console.log('El bot arrancara automaticamente.');
  console.log('============================================\n');
}

// ========================
// BOT PRINCIPAL (todo lo que estaba en index.js)
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
  let teamMonitorTimer = null;

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

  // Iniciar
  discord.login(config.discord.token).catch((err) => {
    console.error('[Bot] ERROR al conectar Discord:', err.message);
    console.log('[Bot] Verifica que DISCORD_TOKEN sea correcto en .env');
    process.exit(1);
  });

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
