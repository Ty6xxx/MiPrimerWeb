const { handleDeviceCommand } = require('./smart-devices');
const { parseDuration, formatDuration, calculateDistance } = require('./state');
const { getSetting, setSetting } = require('./bot-config');
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

// Prefijo para comandos en el team chat del juego
const COMMAND_PREFIX = '!';

// Referencia al estado global (se setea desde index.js)
let botState = null;

function setBotState(state) {
  botState = state;
}

async function handleTeamMessage(rustClient, msg) {
  const text = msg.message.trim();

  if (!text.startsWith(COMMAND_PREFIX)) return null;

  // Si el bot esta silenciado, solo responder a !resume
  const args = text.slice(COMMAND_PREFIX.length).split(/\s+/);
  const command = args.shift().toLowerCase();

  if (botState && botState.isSilenced() && command !== 'resume') {
    return null;
  }

  switch (command) {
    // ========================
    // Dispositivos
    // ========================
    case 'on':
    case 'encender': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !on <dispositivo>';
      return handleDeviceCommand(rustClient, 'on', deviceName);
    }

    case 'off':
    case 'apagar': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !off <dispositivo>';
      return handleDeviceCommand(rustClient, 'off', deviceName);
    }

    case 'status':
    case 'estado': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !status <dispositivo>';
      return handleDeviceCommand(rustClient, 'status', deviceName);
    }

    // ========================
    // Servidor
    // ========================
    case 'pop':
    case 'players': {
      try {
        const info = await rustClient.getServerInfo();
        return `Jugadores: ${info.players}/${info.maxPlayers} | Cola: ${info.queuedPlayers}`;
      } catch {
        return 'Error al obtener info del servidor.';
      }
    }

    case 'time':
    case 'hora': {
      try {
        const time = await rustClient.getTime();
        const dayNight = time.time >= 7 && time.time < 19.5 ? 'DIA' : 'NOCHE';
        return `Hora: ${time.time.toFixed(1)} (${dayNight}) | Amanecer: ${time.sunrise.toFixed(1)} | Atardecer: ${time.sunset.toFixed(1)}`;
      } catch {
        return 'Error al obtener la hora.';
      }
    }

    // ========================
    // Silence / Resume
    // ========================
    case 'silence': {
      if (!botState) return 'Error interno.';
      const timeStr = args.join('');
      if (!timeStr) return 'Uso: !silence <tiempo> (ej: !silence 2h30m, !silence 5m)';
      const ms = parseDuration(timeStr);
      if (ms <= 0) return 'Tiempo invalido. Ej: !silence 2h30m';
      botState.silence(ms);
      return `Bot silenciado por ${formatDuration(ms)}.`;
    }

    case 'resume': {
      if (!botState) return 'Error interno.';
      if (!botState.isSilenced()) return 'El bot no esta silenciado.';
      botState.resume();
      return 'Bot activo de nuevo.';
    }

    // ========================
    // Equipo
    // ========================
    case 'afk': {
      if (!botState) return 'Error interno.';
      const afkList = botState.getAfkMembers();
      if (afkList.length === 0) return 'No hay miembros AFK.';
      return 'AFK: ' + afkList.map(m => m.name).join(', ');
    }

    case 'alive': {
      if (!botState) return 'Error interno.';
      const longest = botState.getLongestAlive();
      if (!longest) return 'No hay jugadores vivos online.';
      const aliveFor = formatDuration(Date.now() - longest.spawnTime);
      return `Mas tiempo vivo: ${longest.name} (${aliveFor})`;
    }

    case 'online': {
      if (!botState) return 'Error interno.';
      const online = botState.getOnlineMembers();
      if (online.length === 0) return 'No hay miembros online.';
      return 'Online: ' + online.map(m => m.name).join(', ');
    }

    case 'offline': {
      if (!botState) return 'Error interno.';
      const offline = botState.getOfflineMembers();
      if (offline.length === 0) return 'Todos estan online!';
      return 'Offline: ' + offline.map(m => m.name).join(', ');
    }

    case 'team':
    case 'equipo': {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const members = teamInfo.members.map(
          (m) => `${m.name}: ${m.isOnline ? 'Online' : 'Offline'}${m.isAlive ? '' : ' (MUERTO)'}`
        );
        return `Equipo:\n${members.join('\n')}`;
      } catch {
        return 'Error al obtener info del equipo.';
      }
    }

    // ========================
    // Proximidad
    // ========================
    case 'proximity':
    case 'prox': {
      if (!botState) return 'Error interno.';
      const positions = botState.getTeamPositions();
      if (positions.length < 2) return 'Se necesitan al menos 2 miembros online.';

      const lines = [];
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          const dist = calculateDistance(a.x, a.y, b.x, b.y);
          lines.push(`${a.name} <-> ${b.name}: ${Math.round(dist)}m`);
        }
      }
      return lines.join('\n');
    }

    // ========================
    // Bot (hablar como el bot)
    // ========================
    case 'bot': {
      const botMsg = args.join(' ');
      if (!botMsg) return 'Uso: !bot <mensaje>';
      rustClient.sendTeamMessage(`[BOT] ${botMsg}`);
      return null; // No responder, ya se envio el mensaje
    }

    // ========================
    // Alarmas
    // ========================
    case 'alarm': {
      if (!botState) return 'Error interno.';
      if (args.length < 2) return 'Uso: !alarm <tiempo> <nombre> (ej: !alarm 2h30m raidear)';
      const timeStr = args.shift();
      const alarmName = args.join(' ');
      const ms = parseDuration(timeStr);
      if (ms <= 0) return 'Tiempo invalido. Ej: !alarm 2h hemp';

      const id = botState.createAlarm(ms, alarmName, (alarmId, name) => {
        rustClient.sendTeamMessage(`[ALARMA #${alarmId}] ${name} - TIEMPO!`);
      });
      return `Alarma #${id} "${alarmName}" creada (${formatDuration(ms)}).`;
    }

    case 'remain': {
      if (!botState) return 'Error interno.';
      const alarms = botState.getAlarms();
      if (alarms.length === 0) return 'No hay alarmas activas.';
      return alarms.map(a => `#${a.id} "${a.name}": ${formatDuration(a.remaining)}`).join('\n');
    }

    case 'stop': {
      if (!botState) return 'Error interno.';
      const alarmId = parseInt(args[0]);
      if (isNaN(alarmId)) return 'Uso: !stop <id>';
      const stopped = botState.stopAlarm(alarmId);
      return stopped ? `Alarma #${alarmId} detenida.` : `Alarma #${alarmId} no encontrada.`;
    }

    // ========================
    // Leader
    // ========================
    case 'leader': {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const targetName = args.join(' ').toLowerCase();

        if (!targetName) {
          // Robar lider: poner al que envio el mensaje
          const sender = teamInfo.members.find(m => m.steamId.toString() === msg.steamId);
          if (!sender) return 'No se encontro tu perfil en el equipo.';
          await rustClient.promoteToLeader(msg.steamId);
          return `${sender.name} ahora es el lider del equipo.`;
        }

        // Dar lider a otro
        const target = teamInfo.members.find(m => m.name.toLowerCase().includes(targetName));
        if (!target) return `No se encontro a "${args.join(' ')}" en el equipo.`;
        await rustClient.promoteToLeader(target.steamId.toString());
        return `${target.name} ahora es el lider del equipo.`;
      } catch (err) {
        return 'Error al cambiar lider: ' + err.message;
      }
    }

    // ========================
    // Eventos del mapa
    // ========================
    case 'cargo': {
      try {
        const markers = await rustClient.getMapMarkers();
        const cargo = markers.find(m => m.type === 5); // CargoShip
        if (!cargo) return 'No hay Cargo Ship en el mapa.';
        return `Cargo Ship en (${Math.round(cargo.x)}, ${Math.round(cargo.y)})`;
      } catch {
        return 'Error al buscar Cargo.';
      }
    }

    case 'small': {
      try {
        const markers = await rustClient.getMapMarkers();
        // Crates en Small Oil = tipo 6 cerca de coordenadas de small oil
        const crates = markers.filter(m => m.type === 6);
        if (crates.length === 0) return 'No hay crates activos en el mapa.';

        // Buscar crates que podrian estar en small oil rig
        const smallOilCrates = crates.filter(m => {
          // Small oil suele estar en coordenadas del borde del mapa
          return true; // Mostrar todos los crates como referencia
        });

        return `Small Oil Rig - Crates activos: ${crates.length}\n` +
          crates.slice(0, 5).map(c => `Crate en (${Math.round(c.x)}, ${Math.round(c.y)})`).join('\n');
      } catch {
        return 'Error al buscar Small Oil.';
      }
    }

    case 'large': {
      try {
        const markers = await rustClient.getMapMarkers();
        const crates = markers.filter(m => m.type === 6);
        if (crates.length === 0) return 'No hay crates activos en el mapa.';

        return `Large Oil Rig - Crates activos: ${crates.length}\n` +
          crates.slice(0, 5).map(c => `Crate en (${Math.round(c.x)}, ${Math.round(c.y)})`).join('\n');
      } catch {
        return 'Error al buscar Large Oil.';
      }
    }

    case 'heli': {
      try {
        const markers = await rustClient.getMapMarkers();
        const heli = markers.find(m => m.type === 8); // PatrolHelicopter
        if (!heli) {
          // Buscar explosion reciente (heli derribado)
          const explosions = markers.filter(m => m.type === 2);
          if (explosions.length > 0) {
            const last = explosions[explosions.length - 1];
            return `Heli no activo. Ultima explosion en (${Math.round(last.x)}, ${Math.round(last.y)})`;
          }
          return 'No hay Patrol Helicopter en el mapa.';
        }
        return `Patrol Helicopter en (${Math.round(heli.x)}, ${Math.round(heli.y)})`;
      } catch {
        return 'Error al buscar Heli.';
      }
    }

    // ========================
    // Chinook / Bradley
    // ========================
    case 'chinook':
    case 'ch47': {
      try {
        const markers = await rustClient.getMapMarkers();
        const chinook = markers.find(m => m.type === 4);
        if (!chinook) return 'No hay Chinook (CH47) en el mapa.';
        return `Chinook CH47 en (${Math.round(chinook.x)}, ${Math.round(chinook.y)})`;
      } catch {
        return 'Error al buscar Chinook.';
      }
    }

    case 'bradley': {
      try {
        const markers = await rustClient.getMapMarkers();
        const bradley = markers.find(m => m.type === 7);
        if (!bradley) return 'No hay Bradley APC en el mapa.';
        return `Bradley APC en (${Math.round(bradley.x)}, ${Math.round(bradley.y)})`;
      } catch {
        return 'Error al buscar Bradley.';
      }
    }

    // ========================
    // Info de items (rustlabs data)
    // ========================
    case 'decay': {
      const query = args.join(' ');
      if (!query) return 'Uso: !decay <item>';
      const results = searchItems(query);
      if (results.length === 0) return `No se encontro "${query}".`;
      for (const item of results) {
        const d = getDecayInfo(item.id);
        if (!d) continue;
        const parts = [`${item.name} (${d.hp} HP)`];
        if (d.decayString) parts.push(`General: ${d.decayString}`);
        if (d.decayOutsideString) parts.push(`Ext: ${d.decayOutsideString}`);
        if (d.decayInsideString) parts.push(`Int: ${d.decayInsideString}`);
        return parts.join(' | ');
      }
      return `No hay datos de decay para "${query}".`;
    }

    case 'recycle': {
      const query = args.join(' ');
      if (!query) return 'Uso: !recycle <item>';
      const results = searchItems(query);
      if (results.length === 0) return `No se encontro "${query}".`;
      for (const item of results) {
        const r = getRecycleInfo(item.id);
        if (!r) continue;
        const yld = r.recycler && r.recycler.yield && r.recycler.yield.length > 0
          ? formatRecycleYield(r.recycler.yield).join(', ')
          : 'Nada';
        return `${item.name} -> ${yld}`;
      }
      return `No hay datos de reciclaje para "${query}".`;
    }

    case 'craft': {
      const query = args.join(' ');
      if (!query) return 'Uso: !craft <item>';
      const results = searchItems(query);
      if (results.length === 0) return `No se encontro "${query}".`;
      for (const item of results) {
        const c = getCraftInfo(item.id);
        if (!c) continue;
        const wb = c.workbench ? (WORKBENCH_NAMES[c.workbench] || `WB:${c.workbench}`) : 'Sin WB';
        const ings = formatIngredients(c.ingredients).join(', ');
        return `${item.name} [${wb}] (${c.timeString}): ${ings}`;
      }
      return `No hay datos de crafteo para "${query}".`;
    }

    case 'stack': {
      const query = args.join(' ');
      if (!query) return 'Uso: !stack <item>';
      const results = searchItems(query);
      if (results.length === 0) return `No se encontro "${query}".`;
      const lines = [];
      for (const item of results.slice(0, 3)) {
        const s = getStackInfo(item.id);
        if (!s) continue;
        lines.push(`${item.name}: ${s.quantity}x`);
      }
      return lines.length > 0 ? lines.join(' | ') : `No hay datos de stack para "${query}".`;
    }

    case 'research': {
      const query = args.join(' ');
      if (!query) return 'Uso: !research <item>';
      const results = searchItems(query);
      if (results.length === 0) return `No se encontro "${query}".`;
      for (const item of results) {
        const r = getResearchInfo(item.id);
        if (!r) continue;
        const parts = [item.name];
        if (r.researchTable) parts.push(`RT: ${r.researchTable} scrap`);
        if (r.workbench) {
          const wb = WORKBENCH_NAMES[r.workbench.type] || `WB:${r.workbench.type}`;
          parts.push(`${wb}: ${r.workbench.scrap} scrap`);
        }
        return parts.join(' | ');
      }
      return `No hay datos de investigacion para "${query}".`;
    }

    // ========================
    // Ayuda
    // ========================
    case 'help':
    case 'ayuda':
      return [
        'Comandos:',
        '!pop !time - Servidor',
        '!online !offline !afk !alive !prox - Equipo',
        '!cargo !heli !small !large !chinook !bradley - Mapa',
        '!decay !recycle !craft !stack !research <item>',
        '!silence <t> !resume !alarm <t> <n> !remain !stop <id>',
        '!leader [nombre] !bot <msg>',
        '!on !off !status <device>',
      ].join('\n');

    default:
      return null;
  }
}

module.exports = { handleTeamMessage, setBotState };
