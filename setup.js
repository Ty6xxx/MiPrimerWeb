const path = require('path');
const fs   = require('fs');
const PushReceiverClient = require('@liamcottle/push-receiver/src/client');

require('dotenv').config();

const ENV_PATH    = path.join(__dirname, '.env');
const CONFIG_PATH = path.join(__dirname, 'rustplus.config.json');

// ========================
// Punto de entrada
// ========================
if (hasValidRustConfig() && hasDiscordConfig()) {
  console.log('[Bot] Configuracion completa en .env\n');
  startBot();
} else if (!hasDiscordConfig()) {
  console.log('[Bot] Discord no configurado. Iniciando servidor web en http://localhost:3000/admin\n');
  startWebServer();
} else {
  // Discord OK pero faltan datos de Rust → mostrar web para hacer pairing
  console.log('[Bot] Faltan datos de Rust+. Abre http://localhost:3000 para hacer el pairing.\n');
  startWebServer();
}

// ========================
// Verificaciones
// ========================
function hasDiscordConfig() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  return !!(token && clientId && !token.includes('tu_'));
}

function hasValidRustConfig() {
  const { RUST_SERVER_IP, RUST_SERVER_PORT, RUST_PLAYER_ID, RUST_PLAYER_TOKEN } = process.env;
  if (!RUST_SERVER_IP || !RUST_SERVER_PORT || !RUST_PLAYER_ID || !RUST_PLAYER_TOKEN) return false;
  if (RUST_SERVER_IP.includes('tu_') || RUST_SERVER_PORT.includes('tu_')) return false;
  if (RUST_PLAYER_ID.includes('tu_') || RUST_PLAYER_TOKEN.includes('tu_')) return false;
  return true;
}

// ========================
// MODO WEB (setup inicial)
// ========================
function startWebServer() {
  const { createWebServer } = require('./src/web-server');

  const app = createWebServer(() => {
    // Callback cuando el setup completa
    startBot();
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Web] Servidor corriendo en http://localhost:${PORT}`);
    if (!hasDiscordConfig()) {
      console.log(`[Web] → Abre http://localhost:${PORT}/admin para configurar Discord primero`);
    } else {
      console.log(`[Web] → Abre http://localhost:${PORT} para conectar tu servidor de Rust`);
    }
  });
}

// ========================
// MODO PAIRING LEGACY (sin web, con rustplus.config.json)
// ========================
function startLegacyPairing() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('============================================');
    console.log('  CONFIGURACION INICIAL');
    console.log('============================================');
    console.log('');
    console.log('Opcion A (recomendada):');
    console.log('  Abre http://localhost:3000 y sigue los pasos');
    console.log('');
    console.log('Opcion B (manual):');
    console.log('  1. Ejecuta: npx @liamcottle/rustplus.js fcm-register');
    console.log('  2. Coloca rustplus.config.json en esta carpeta');
    console.log('  3. Vuelve a ejecutar: npm start');
    console.log('============================================\n');
    return;
  }

  let config;
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch (err) { console.log('[Pairing] ERROR leyendo rustplus.config.json:', err.message); return; }

  if (!config.fcm_credentials?.gcm) {
    console.log('[Pairing] ERROR: fcm_credentials.gcm no encontrado.');
    return;
  }

  const androidId     = String(config.fcm_credentials.gcm.androidId     || config.fcm_credentials.gcm.android_id     || '');
  const securityToken = String(config.fcm_credentials.gcm.securityToken || config.fcm_credentials.gcm.security_token || '');

  if (!androidId || !securityToken) {
    console.log('[Pairing] ERROR: androidId o securityToken vacios.');
    return;
  }

  createFcmListener(androidId, securityToken);
}

function createFcmListener(androidId, securityToken) {
  const pushClient = new PushReceiverClient(androidId, securityToken, []);

  pushClient.on('connect', () => {
    console.log('[FCM] Conexion establecida.');
    console.log('\n============================================');
    console.log('  MODO PAIRING ACTIVO');
    console.log('============================================');
    console.log('Abre Rust → ESC → Rust+ → PAIR WITH SERVER');
    console.log('El bot arrancara automaticamente.');
    console.log('============================================\n');
  });

  pushClient.on('disconnect', () => {
    console.log('[FCM] Desconectado. Reconectando...');
  });

  pushClient.on('ON_DATA_RECEIVED', (data) => {
    handleFcmPairing(data, pushClient);
  });

  pushClient.connect().catch(err => {
    console.log('[FCM] ERROR al conectar:', err.message);
    console.log('[FCM] Reintentando en 30s...');
    setTimeout(() => createFcmListener(androidId, securityToken), 30000);
  });
}

function handleFcmPairing(data, pushClient) {
  const appData = data.appData || data.rawData || data.data;
  if (!appData) return;

  let channelId, title, bodyRaw;
  if (Array.isArray(appData)) {
    channelId = appData.find(i => i.key === 'channelId')?.value;
    title     = appData.find(i => i.key === 'title')?.value;
    bodyRaw   = appData.find(i => i.key === 'body')?.value;
  } else {
    channelId = appData.channelId;
    title     = appData.title;
    bodyRaw   = appData.body;
  }

  console.log(`[FCM] Notificacion: channelId="${channelId}", title="${title || ''}"`);

  if (channelId !== 'pairing' || !bodyRaw) return;

  let body;
  try { body = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw; }
  catch { return; }

  if (body.type !== 'server') return;
  if (!body.ip || !body.port || !body.playerId || body.playerToken === undefined) return;

  console.log('\n============================================');
  console.log('  PAIRING EXITOSO!');
  console.log('============================================');
  console.log(`  Servidor: ${title || body.name}`);
  console.log(`  IP:       ${body.ip}`);
  console.log(`  Puerto:   ${body.port}`);
  console.log('============================================\n');

  const rustVars = {
    RUST_SERVER_IP:    String(body.ip),
    RUST_SERVER_PORT:  String(body.port),
    RUST_PLAYER_ID:    String(body.playerId),
    RUST_PLAYER_TOKEN: String(body.playerToken),
  };

  // Leer .env actual y actualizar
  let envContent = '';
  try { envContent = fs.readFileSync(ENV_PATH, 'utf-8'); } catch {}
  for (const [key, value] of Object.entries(rustVars)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  fs.writeFileSync(ENV_PATH, envContent.trim() + '\n');

  Object.assign(process.env, rustVars);

  try { pushClient.destroy(); } catch {}
  startBot();
}

// ========================
// BOT PRINCIPAL
// ========================
function startBot() {
  const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
  const RustPlusClient  = require('./src/rustplus-client');
  const { registerCommands } = require('./src/commands/register-commands');
  const { handleInteraction, setBotState: setHandlerState } = require('./src/commands/handle-commands');
  const { handleTeamMessage, setBotState: setChatState }    = require('./src/handlers/team-chat');
  const { formatEventMessage, formatEventEndMessage, formatTeamChangeEmbed } = require('./src/handlers/events');
  const { BotState } = require('./src/handlers/state');
  const config = require('./src/config');

  if (!config.discord.token) {
    console.log('[Bot] ERROR: DISCORD_TOKEN no configurado.');
    return;
  }

  console.log('[Bot] Iniciando Rust+ Discord Bot...');
  console.log(`[Bot] Servidor: ${config.rust.serverIp}:${config.rust.serverPort}`);

  const botState = new BotState();

  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const rustClient = new RustPlusClient();
  let notificationChannel = null;
  let teamMonitorTimer    = null;

  setHandlerState(botState);
  setChatState(botState);
  botState.setSendMessage(msg => {
    if (!botState.isSilenced()) rustClient.sendGameMessage(msg);
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
        guild.channels.cache.find(c => c.name === 'rust'     && c.type === ChannelType.GuildText) ||
        guild.channels.cache.find(c => c.type === ChannelType.GuildText);
      if (notificationChannel)
        console.log(`[Discord] Canal de notificaciones: #${notificationChannel.name}`);
    }

    await registerCommands();
    rustClient.connect();
  });

  discord.on('interactionCreate', interaction => {
    handleInteraction(interaction, rustClient);
  });

  // ========================
  // Rust+ Events
  // ========================
  rustClient.on('ready', () => {
    console.log('');
    console.log('============================================');
    console.log('  BOT CONECTADO Y FUNCIONANDO!');
    console.log('============================================');
    console.log(`  Servidor: ${config.rust.serverIp}:${config.rust.serverPort}`);
    console.log('  Escribe !help en Rust para ver comandos');
    console.log('============================================\n');

    if (teamMonitorTimer) clearInterval(teamMonitorTimer);
    teamMonitorTimer = setInterval(async () => {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const changes  = botState.updateTeamState(teamInfo.members);
        if (botState.isSilenced()) return;

        const msgs = [];
        for (const name of changes.connected)    msgs.push(`[BOT] ${name} se conecto.`);
        for (const name of changes.disconnected) msgs.push(`[BOT] ${name} se desconecto.`);
        for (const d of changes.died)            msgs.push(`[BOT] ${d.name} murio en (${Math.round(d.x)}, ${Math.round(d.y)}) | Muertes: ${d.deathCount}`);
        for (const name of changes.afkStart)     msgs.push(`[BOT] ${name} esta AFK.`);
        for (const name of changes.afkEnd)       msgs.push(`[BOT] ${name} volvio de AFK.`);

        msgs.forEach((m, i) => setTimeout(() => rustClient.sendGameMessage(m), i * 1800));

        if (notificationChannel) {
          const embeds = formatTeamChangeEmbed(changes);
          for (const embed of embeds) notificationChannel.send({ embeds: [embed] });
        }
      } catch (_) {}
    }, 15000);
  });

  rustClient.on('gameEvent', event => {
    if (botState.isSilenced()) return;
    const msg = formatEventMessage(event);
    rustClient.sendGameMessage(`[BOT] ${msg}`);
    if (notificationChannel) notificationChannel.send(msg);
  });

  rustClient.on('gameEventEnd', event => {
    if (botState.isSilenced()) return;
    const msg = formatEventEndMessage(event);
    rustClient.sendGameMessage(`[BOT] ${msg}`);
    if (notificationChannel) notificationChannel.send(msg);
  });

  rustClient.on('teamMessage', async msg => {
    const response = await handleTeamMessage(rustClient, msg);
    if (response) rustClient.sendGameMessage(response);
  });

  discord.login(config.discord.token).catch(err => {
    console.error('[Bot] ERROR Discord login:', err.message);
    process.exit(1);
  });

  process.on('unhandledRejection', err => {
    console.error('[Bot] Error no manejado:', err.message || err);
  });

  process.on('SIGINT', () => {
    console.log('\n[Bot] Apagando...');
    if (teamMonitorTimer) clearInterval(teamMonitorTimer);
    rustClient.stopEventPolling();
    discord.destroy();
    process.exit(0);
  });
}
