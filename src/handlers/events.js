// ========================
// Formato de eventos del juego
// ========================

function formatEventMessage(event) {
  const emojis = {
    'CargoShip': '🚢',
    'PatrolHelicopter': '🚁',
    'CH47 (Chinook)': '🛩️',
    'Explosion': '💥',
    'Crate': '📦',
  };

  const names = {
    'CargoShip': 'Cargo Ship',
    'PatrolHelicopter': 'Patrol Helicopter',
    'CH47 (Chinook)': 'CH47 Chinook',
    'Explosion': 'Explosion',
    'Crate': 'Crate',
  };

  const emoji = emojis[event.type] || '⚠️';
  const name = names[event.type] || event.type;
  const coords = event.marker
    ? ` en (${Math.round(event.marker.x)}, ${Math.round(event.marker.y)})`
    : '';

  return `${emoji} **${name}** detectado${coords}!`;
}

function formatEventEndMessage(event) {
  const emojis = {
    'CargoShip': '🚢',
    'PatrolHelicopter': '🚁',
    'CH47 (Chinook)': '🛩️',
    'Explosion': '💥',
    'Crate': '📦',
  };

  const names = {
    'CargoShip': 'Cargo Ship',
    'PatrolHelicopter': 'Patrol Helicopter',
    'CH47 (Chinook)': 'CH47 Chinook',
    'Explosion': 'Explosion',
    'Crate': 'Crate',
  };

  const emoji = emojis[event.type] || '⚠️';
  const name = names[event.type] || event.type;
  return `${emoji} **${name}** ha desaparecido del mapa.`;
}

// Formato para notificaciones de Discord (con embeds)
function formatEventEmbed(event, isEnd = false) {
  const colors = {
    'CargoShip': 0x3498db,
    'PatrolHelicopter': 0xe74c3c,
    'CH47 (Chinook)': 0xf39c12,
    'Explosion': 0xe67e22,
    'Crate': 0x2ecc71,
  };

  const emojis = {
    'CargoShip': '🚢',
    'PatrolHelicopter': '🚁',
    'CH47 (Chinook)': '🛩️',
    'Explosion': '💥',
    'Crate': '📦',
  };

  const emoji = emojis[event.type] || '⚠️';
  const color = colors[event.type] || 0x95a5a6;

  const embed = {
    color,
    title: `${emoji} ${event.type}`,
    description: isEnd
      ? 'Ha desaparecido del mapa.'
      : `Detectado en el mapa!`,
    fields: [],
    timestamp: new Date().toISOString(),
  };

  if (event.marker && !isEnd) {
    embed.fields.push({
      name: 'Coordenadas',
      value: `(${Math.round(event.marker.x)}, ${Math.round(event.marker.y)})`,
      inline: true,
    });
  }

  return { embeds: [embed] };
}

// Formato para cambios de equipo (conexiones, muertes, etc.)
function formatTeamChangeEmbed(changes) {
  const embeds = [];

  for (const name of changes.connected) {
    embeds.push({
      color: 0x2ecc71,
      description: `🟢 **${name}** se conecto.`,
      timestamp: new Date().toISOString(),
    });
  }

  for (const name of changes.disconnected) {
    embeds.push({
      color: 0xe74c3c,
      description: `🔴 **${name}** se desconecto.`,
      timestamp: new Date().toISOString(),
    });
  }

  for (const d of changes.died) {
    embeds.push({
      color: 0x000000,
      description: `💀 **${d.name}** murio en (${Math.round(d.x)}, ${Math.round(d.y)}) | Muertes: ${d.deathCount}`,
      timestamp: new Date().toISOString(),
    });
  }

  for (const name of changes.afkStart) {
    embeds.push({
      color: 0xf39c12,
      description: `💤 **${name}** esta AFK.`,
      timestamp: new Date().toISOString(),
    });
  }

  for (const name of changes.afkEnd) {
    embeds.push({
      color: 0x3498db,
      description: `🏃 **${name}** volvio de AFK.`,
      timestamp: new Date().toISOString(),
    });
  }

  return embeds;
}

module.exports = { formatEventMessage, formatEventEndMessage, formatEventEmbed, formatTeamChangeEmbed };
