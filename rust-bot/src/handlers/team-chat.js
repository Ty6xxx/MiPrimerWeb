const { handleDeviceCommand, getDevice } = require('./smart-devices');

// Prefijo para comandos en el team chat del juego
const COMMAND_PREFIX = '!';

async function handleTeamMessage(rustClient, msg) {
  const text = msg.message.trim();

  if (!text.startsWith(COMMAND_PREFIX)) return null;

  const args = text.slice(COMMAND_PREFIX.length).split(/\s+/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'on':
    case 'encender': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !on <nombre_dispositivo>';
      return handleDeviceCommand(rustClient, 'on', deviceName);
    }

    case 'off':
    case 'apagar': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !off <nombre_dispositivo>';
      return handleDeviceCommand(rustClient, 'off', deviceName);
    }

    case 'status':
    case 'estado': {
      const deviceName = args.join(' ');
      if (!deviceName) return 'Uso: !status <nombre_dispositivo>';
      return handleDeviceCommand(rustClient, 'status', deviceName);
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

    case 'pop':
    case 'players': {
      try {
        const info = await rustClient.getServerInfo();
        return `Jugadores: ${info.players}/${info.maxPlayers} | Cola: ${info.queuedPlayers}`;
      } catch {
        return 'Error al obtener info del servidor.';
      }
    }

    case 'team':
    case 'equipo': {
      try {
        const teamInfo = await rustClient.getTeamInfo();
        const members = teamInfo.members.map(
          (m) =>
            `${m.name}: ${m.isOnline ? 'Online' : 'Offline'}${m.isAlive ? '' : ' (MUERTO)'}`
        );
        return `Equipo:\n${members.join('\n')}`;
      } catch {
        return 'Error al obtener info del equipo.';
      }
    }

    case 'help':
    case 'ayuda':
      return [
        'Comandos disponibles:',
        '!on/!encender <dispositivo> - Encender switch',
        '!off/!apagar <dispositivo> - Apagar switch',
        '!status/!estado <dispositivo> - Estado del switch',
        '!time/!hora - Hora del servidor',
        '!pop/!players - Jugadores online',
        '!team/!equipo - Info del equipo',
      ].join('\n');

    default:
      return null;
  }
}

module.exports = { handleTeamMessage };
