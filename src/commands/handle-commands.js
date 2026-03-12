const {
  handleDeviceCommand,
  registerDevice,
  removeDevice,
  getAllDevices,
} = require('../handlers/smart-devices');
const { searchRaidCost } = require('../data/raid-costs');
const { parseDuration, formatDuration, calculateDistance } = require('../handlers/state');
const {
  searchItems,
  getDecayInfo,
  getRecycleInfo,
  getCraftInfo,
  getStackInfo,
  getResearchInfo,
  formatIngredients,
  formatRecycleYield,
  WORKBENCH_NAMES,
} = require('../utils/item-search');

// Referencia al estado global (se setea desde index.js)
let botState = null;
// Trackers: Map<guildId, Map<name, { items: string[], messageId }>>
const trackers = new Map();

function setBotState(state) {
  botState = state;
}

async function handleInteraction(interaction, rustClient) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'server': {
        await interaction.deferReply();
        const info = await rustClient.getServerInfo();
        await interaction.editReply(
          [
            `**${info.name}**`,
            `Mapa: ${info.map} (${info.mapSize})`,
            `Jugadores: ${info.players}/${info.maxPlayers}`,
            `Cola: ${info.queuedPlayers}`,
            `Seed: ${info.seed}`,
          ].join('\n')
        );
        break;
      }

      case 'time': {
        await interaction.deferReply();
        const time = await rustClient.getTime();
        const dayNight =
          time.time >= 7 && time.time < 19.5 ? '☀️ DIA' : '🌙 NOCHE';
        await interaction.editReply(
          `⏰ Hora: **${time.time.toFixed(1)}** (${dayNight}) | Amanecer: ${time.sunrise.toFixed(1)} | Atardecer: ${time.sunset.toFixed(1)}`
        );
        break;
      }

      case 'team': {
        await interaction.deferReply();
        const teamInfo = await rustClient.getTeamInfo();
        const members = teamInfo.members
          .map(
            (m) =>
              `${m.isOnline ? '🟢' : '🔴'} **${m.name}**: ${m.isOnline ? 'Online' : 'Offline'}${m.isAlive ? '' : ' 💀'}`
          )
          .join('\n');
        await interaction.editReply(`**Equipo:**\n${members}`);
        break;
      }

      case 'pop': {
        await interaction.deferReply();
        const info = await rustClient.getServerInfo();
        await interaction.editReply(
          `👥 Jugadores: **${info.players}/${info.maxPlayers}** | Cola: ${info.queuedPlayers}`
        );
        break;
      }

      case 'online': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const online = botState.getOnlineMembers();
        if (online.length === 0) {
          await interaction.reply('No hay miembros online.');
        } else {
          await interaction.reply('🟢 **Online:** ' + online.map(m => m.name).join(', '));
        }
        break;
      }

      case 'offline': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const offline = botState.getOfflineMembers();
        if (offline.length === 0) {
          await interaction.reply('Todos estan online!');
        } else {
          await interaction.reply('🔴 **Offline:** ' + offline.map(m => m.name).join(', '));
        }
        break;
      }

      case 'afk': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const afkList = botState.getAfkMembers();
        if (afkList.length === 0) {
          await interaction.reply('No hay miembros AFK.');
        } else {
          await interaction.reply('💤 **AFK:** ' + afkList.map(m => m.name).join(', '));
        }
        break;
      }

      case 'alive': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const longest = botState.getLongestAlive();
        if (!longest) {
          await interaction.reply('No hay jugadores vivos online.');
        } else {
          const aliveFor = formatDuration(Date.now() - longest.spawnTime);
          await interaction.reply(`🏆 Mas tiempo vivo: **${longest.name}** (${aliveFor})`);
        }
        break;
      }

      case 'proximity': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        await interaction.deferReply();
        const positions = botState.getTeamPositions();
        if (positions.length < 2) {
          await interaction.editReply('Se necesitan al menos 2 miembros online.');
          break;
        }
        const lines = [];
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const a = positions[i];
            const b = positions[j];
            const dist = calculateDistance(a.x, a.y, b.x, b.y);
            lines.push(`📍 **${a.name}** ↔ **${b.name}**: ${Math.round(dist)}m`);
          }
        }
        await interaction.editReply(lines.join('\n'));
        break;
      }

      case 'cargo': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        const cargo = markers.find(m => m.type === 5);
        if (!cargo) {
          await interaction.editReply('🚢 No hay Cargo Ship en el mapa.');
        } else {
          await interaction.editReply(`🚢 **Cargo Ship** en (${Math.round(cargo.x)}, ${Math.round(cargo.y)})`);
        }
        break;
      }

      case 'heli': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        const heli = markers.find(m => m.type === 8);
        if (!heli) {
          const explosions = markers.filter(m => m.type === 2);
          if (explosions.length > 0) {
            const last = explosions[explosions.length - 1];
            await interaction.editReply(`🚁 Heli no activo. Ultima explosion en (${Math.round(last.x)}, ${Math.round(last.y)})`);
          } else {
            await interaction.editReply('🚁 No hay Patrol Helicopter en el mapa.');
          }
        } else {
          await interaction.editReply(`🚁 **Patrol Helicopter** en (${Math.round(heli.x)}, ${Math.round(heli.y)})`);
        }
        break;
      }

      case 'small': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        const crates = markers.filter(m => m.type === 6);
        if (crates.length === 0) {
          await interaction.editReply('⛽ No hay crates activos.');
        } else {
          const list = crates.slice(0, 5).map(c => `📦 Crate en (${Math.round(c.x)}, ${Math.round(c.y)})`).join('\n');
          await interaction.editReply(`⛽ **Small Oil Rig** - Crates: ${crates.length}\n${list}`);
        }
        break;
      }

      case 'large': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        const crates = markers.filter(m => m.type === 6);
        if (crates.length === 0) {
          await interaction.editReply('🛢️ No hay crates activos.');
        } else {
          const list = crates.slice(0, 5).map(c => `📦 Crate en (${Math.round(c.x)}, ${Math.round(c.y)})`).join('\n');
          await interaction.editReply(`🛢️ **Large Oil Rig** - Crates: ${crates.length}\n${list}`);
        }
        break;
      }

      case 'switch': {
        await interaction.deferReply();
        const action = interaction.options.getString('action');
        const device = interaction.options.getString('device');
        const result = await handleDeviceCommand(rustClient, action, device);
        await interaction.editReply(result);
        break;
      }

      case 'device-add': {
        const name = interaction.options.getString('name');
        const entityId = interaction.options.getString('entity_id');
        registerDevice(name, entityId);
        await interaction.reply(
          `Dispositivo **${name}** registrado con ID: ${entityId}`
        );
        break;
      }

      case 'device-remove': {
        const name = interaction.options.getString('name');
        const removed = removeDevice(name);
        await interaction.reply(
          removed
            ? `Dispositivo **${name}** eliminado.`
            : `No se encontro dispositivo "${name}".`
        );
        break;
      }

      case 'devices': {
        const deviceList = getAllDevices();
        if (deviceList.length === 0) {
          await interaction.reply(
            'No hay dispositivos registrados. Usa /device-add para agregar uno.'
          );
        } else {
          const list = deviceList
            .map((d) => `- **${d.name}**: ${d.id}`)
            .join('\n');
          await interaction.reply(`**Dispositivos registrados:**\n${list}`);
        }
        break;
      }

      case 'item': {
        await interaction.deferReply();
        const itemName = interaction.options.getString('name');
        const results = await rustClient.searchVending(itemName);
        if (results.length === 0) {
          await interaction.editReply(
            `🏪 No se encontraron vending machines con "${itemName}".`
          );
        } else {
          const list = results
            .slice(0, 10)
            .map(
              (r) =>
                `🏪 **${r.name}** en (${Math.round(r.location.x)}, ${Math.round(r.location.y)}): ${r.amountInStock}x disponibles`
            )
            .join('\n');
          await interaction.editReply(
            `**Resultados para "${itemName}":**\n${list}`
          );
        }
        break;
      }

      case 'cost': {
        const name = interaction.options.getString('name');
        const results = searchRaidCost(name);
        if (results.length === 0) {
          await interaction.reply(`No se encontro costo de raid para "${name}".`);
        } else {
          const list = results.map(r =>
            `💣 **${r.name}**\nC4: ${r.c4} | Rockets: ${r.rockets} | Satchels: ${r.satchels} | Explosive Ammo: ${r.expAmmo}`
          ).join('\n\n');
          await interaction.reply(list);
        }
        break;
      }

      case 'tracker': {
        const name = interaction.options.getString('name');
        const guildId = interaction.guildId;
        if (!trackers.has(guildId)) trackers.set(guildId, new Map());
        const guildTrackers = trackers.get(guildId);

        if (guildTrackers.has(name)) {
          await interaction.reply(`Tracker "${name}" ya existe.`);
        } else {
          guildTrackers.set(name, { items: [], createdAt: Date.now() });
          await interaction.reply(`📋 Tracker **${name}** creado. Usa el team chat para actualizar su estado.`);
        }
        break;
      }

      case 'say': {
        const message = interaction.options.getString('message');
        rustClient.sendTeamMessage(message);
        await interaction.reply(`💬 Mensaje enviado: "${message}"`);
        break;
      }

      case 'silence': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const timeStr = interaction.options.getString('time');
        const ms = parseDuration(timeStr);
        if (ms <= 0) {
          await interaction.reply('Tiempo invalido. Ej: 2h30m, 5m, 1h');
          break;
        }
        botState.silence(ms);
        await interaction.reply(`🔇 Bot silenciado por ${formatDuration(ms)}.`);
        break;
      }

      case 'resume': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        if (!botState.isSilenced()) {
          await interaction.reply('El bot no esta silenciado.');
        } else {
          botState.resume();
          await interaction.reply('🔊 Bot activo de nuevo.');
        }
        break;
      }

      case 'alarm': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const timeStr = interaction.options.getString('time');
        const alarmName = interaction.options.getString('name');
        const ms = parseDuration(timeStr);
        if (ms <= 0) {
          await interaction.reply('Tiempo invalido. Ej: 2h30m, 9m');
          break;
        }
        const id = botState.createAlarm(ms, alarmName, (alarmId, name) => {
          interaction.channel.send(`⏰ **[ALARMA #${alarmId}]** ${name} - TIEMPO!`);
          rustClient.sendTeamMessage(`[ALARMA #${alarmId}] ${name} - TIEMPO!`);
        });
        await interaction.reply(`⏰ Alarma #${id} **"${alarmName}"** creada (${formatDuration(ms)}).`);
        break;
      }

      case 'remain': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const alarms = botState.getAlarms();
        if (alarms.length === 0) {
          await interaction.reply('No hay alarmas activas.');
        } else {
          const list = alarms.map(a => `⏰ #${a.id} **"${a.name}"**: ${formatDuration(a.remaining)}`).join('\n');
          await interaction.reply(list);
        }
        break;
      }

      case 'stop': {
        if (!botState) { await interaction.reply('Bot no inicializado.'); break; }
        const alarmId = interaction.options.getInteger('id');
        const stopped = botState.stopAlarm(alarmId);
        await interaction.reply(stopped
          ? `⏰ Alarma #${alarmId} detenida.`
          : `Alarma #${alarmId} no encontrada.`
        );
        break;
      }

      case 'leader': {
        await interaction.deferReply();
        const teamInfo = await rustClient.getTeamInfo();
        const targetName = interaction.options.getString('name');

        if (!targetName) {
          // Sin nombre = info del lider actual
          const leader = teamInfo.members.find(m => m.isLeader);
          if (leader) {
            await interaction.editReply(`👑 Lider actual: **${leader.name}**`);
          } else {
            await interaction.editReply('No se pudo determinar el lider.');
          }
        } else {
          const target = teamInfo.members.find(m => m.name.toLowerCase().includes(targetName.toLowerCase()));
          if (!target) {
            await interaction.editReply(`No se encontro a "${targetName}" en el equipo.`);
          } else {
            await rustClient.promoteToLeader(target.steamId.toString());
            await interaction.editReply(`👑 **${target.name}** ahora es el lider del equipo.`);
          }
        }
        break;
      }

      case 'decay': {
        await interaction.deferReply();
        const query = interaction.options.getString('item');
        const results = searchItems(query);
        if (results.length === 0) {
          await interaction.editReply(`No se encontro ningun item con "${query}".`);
          break;
        }
        const lines = [];
        for (const item of results) {
          const d = getDecayInfo(item.id);
          if (!d) continue;
          const parts = [`⏳ **${item.name}** (${d.hp} HP)`];
          if (d.decayString) parts.push(`General: ${d.decayString}`);
          if (d.decayOutsideString) parts.push(`Exterior: ${d.decayOutsideString}`);
          if (d.decayInsideString) parts.push(`Interior: ${d.decayInsideString}`);
          if (d.decayUnderwaterString) parts.push(`Bajo agua: ${d.decayUnderwaterString}`);
          lines.push(parts.join(' | '));
        }
        if (lines.length === 0) {
          await interaction.editReply(`No hay datos de decay para "${query}".`);
        } else {
          await interaction.editReply(lines.join('\n'));
        }
        break;
      }

      case 'recycle': {
        await interaction.deferReply();
        const query = interaction.options.getString('item');
        const results = searchItems(query);
        if (results.length === 0) {
          await interaction.editReply(`No se encontro ningun item con "${query}".`);
          break;
        }
        const lines = [];
        for (const item of results.slice(0, 3)) {
          const r = getRecycleInfo(item.id);
          if (!r) continue;
          const recyclerYield = r.recycler && r.recycler.yield && r.recycler.yield.length > 0
            ? formatRecycleYield(r.recycler.yield).join(', ')
            : 'Nada';
          lines.push(`♻️ **${item.name}** → ${recyclerYield}`);
        }
        if (lines.length === 0) {
          await interaction.editReply(`No hay datos de reciclaje para "${query}".`);
        } else {
          await interaction.editReply(lines.join('\n'));
        }
        break;
      }

      case 'craft': {
        await interaction.deferReply();
        const query = interaction.options.getString('item');
        const results = searchItems(query);
        if (results.length === 0) {
          await interaction.editReply(`No se encontro ningun item con "${query}".`);
          break;
        }
        const lines = [];
        for (const item of results.slice(0, 3)) {
          const c = getCraftInfo(item.id);
          if (!c) continue;
          const wb = c.workbench ? (WORKBENCH_NAMES[c.workbench] || `WB:${c.workbench}`) : 'Sin workbench';
          const ings = formatIngredients(c.ingredients).join(', ');
          lines.push(`🔨 **${item.name}** [${wb}] (${c.timeString})\n  Ingredientes: ${ings}`);
        }
        if (lines.length === 0) {
          await interaction.editReply(`No hay datos de crafteo para "${query}".`);
        } else {
          await interaction.editReply(lines.join('\n\n'));
        }
        break;
      }

      case 'stack': {
        const query = interaction.options.getString('item');
        const results = searchItems(query);
        if (results.length === 0) {
          await interaction.reply(`No se encontro ningun item con "${query}".`);
          break;
        }
        const lines = [];
        for (const item of results.slice(0, 5)) {
          const s = getStackInfo(item.id);
          if (!s) continue;
          lines.push(`📦 **${item.name}**: ${s.quantity}x`);
        }
        if (lines.length === 0) {
          await interaction.reply(`No hay datos de stack para "${query}".`);
        } else {
          await interaction.reply(lines.join('\n'));
        }
        break;
      }

      case 'research': {
        const query = interaction.options.getString('item');
        const results = searchItems(query);
        if (results.length === 0) {
          await interaction.reply(`No se encontro ningun item con "${query}".`);
          break;
        }
        const lines = [];
        for (const item of results.slice(0, 5)) {
          const r = getResearchInfo(item.id);
          if (!r) continue;
          const parts = [`🔬 **${item.name}**`];
          if (r.researchTable) parts.push(`Research Table: ${r.researchTable} scrap`);
          if (r.workbench) {
            const wb = WORKBENCH_NAMES[r.workbench.type] || `WB:${r.workbench.type}`;
            parts.push(`${wb}: ${r.workbench.scrap} scrap (total: ${r.workbench.totalScrap})`);
          }
          lines.push(parts.join(' | '));
        }
        if (lines.length === 0) {
          await interaction.reply(`No hay datos de investigacion para "${query}".`);
        } else {
          await interaction.reply(lines.join('\n'));
        }
        break;
      }

      case 'chinook': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        // Chinook type = 4
        const chinook = markers.find(m => m.type === 4);
        if (!chinook) {
          await interaction.editReply('🚁 No hay Chinook (CH47) en el mapa.');
        } else {
          await interaction.editReply(`🚁 **Chinook CH47** en (${Math.round(chinook.x)}, ${Math.round(chinook.y)})`);
        }
        break;
      }

      case 'bradley': {
        await interaction.deferReply();
        const markers = await rustClient.getMapMarkers();
        // Bradley type = 7
        const bradley = markers.find(m => m.type === 7);
        if (!bradley) {
          await interaction.editReply('🚗 No hay Bradley APC en el mapa.');
        } else {
          await interaction.editReply(`🚗 **Bradley APC** en (${Math.round(bradley.x)}, ${Math.round(bradley.y)})`);
        }
        break;
      }
    }
  } catch (err) {
    const reply = `❌ Error: ${err.message}`;
    if (interaction.deferred) {
      await interaction.editReply(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

module.exports = { handleInteraction, setBotState };
