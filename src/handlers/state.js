// ========================
// Estado central del bot
// ========================

class BotState {
  constructor() {
    // Silence (mutear bot)
    this.silenced = false;
    this.silenceTimer = null;
    this.silenceUntil = null;

    // Alarmas: Map<id, { name, timer, endsAt }>
    this.alarms = new Map();
    this.alarmCounter = 0;

    // Team tracking: Map<steamId, { name, isOnline, isAlive, x, y, lastMoved, deathCount }>
    this.teamState = new Map();

    // Event tracking: Map<key, { type, marker, firstSeen }>
    this.activeEvents = new Map();

    // Callback para enviar mensajes
    this.sendMessage = null;
  }

  setSendMessage(fn) {
    this.sendMessage = fn;
  }

  // ========================
  // Silence
  // ========================
  silence(durationMs) {
    this.silenced = true;
    this.silenceUntil = Date.now() + durationMs;

    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.silenced = false;
      this.silenceUntil = null;
      this.silenceTimer = null;
      if (this.sendMessage) this.sendMessage('[BOT] Silencio terminado. Bot activo de nuevo.');
    }, durationMs);
  }

  resume() {
    this.silenced = false;
    this.silenceUntil = null;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  isSilenced() {
    return this.silenced;
  }

  // ========================
  // Alarmas
  // ========================
  createAlarm(durationMs, name, callback) {
    this.alarmCounter++;
    const id = this.alarmCounter;
    const endsAt = Date.now() + durationMs;

    const timer = setTimeout(() => {
      this.alarms.delete(id);
      if (callback) callback(id, name);
    }, durationMs);

    this.alarms.set(id, { id, name, timer, endsAt });
    return id;
  }

  stopAlarm(id) {
    const alarm = this.alarms.get(id);
    if (!alarm) return false;

    clearTimeout(alarm.timer);
    this.alarms.delete(id);
    return true;
  }

  getAlarms() {
    const now = Date.now();
    return Array.from(this.alarms.values()).map(a => ({
      id: a.id,
      name: a.name,
      remaining: Math.max(0, a.endsAt - now),
    }));
  }

  // ========================
  // Team State
  // ========================
  updateTeamState(members) {
    const changes = { connected: [], disconnected: [], died: [], afkStart: [], afkEnd: [] };
    const now = Date.now();

    for (const m of members) {
      const steamId = m.steamId.toString();
      const prev = this.teamState.get(steamId);

      if (prev) {
        // Conexion/desconexion
        if (!prev.isOnline && m.isOnline) {
          changes.connected.push(m.name);
        } else if (prev.isOnline && !m.isOnline) {
          changes.disconnected.push(m.name);
        }

        // Muerte
        if (prev.isAlive && !m.isAlive) {
          changes.died.push({ name: m.name, x: m.x, y: m.y, deathCount: (prev.deathCount || 0) + 1 });
        }

        // AFK detection (no se movio en 5 min)
        const moved = prev.x !== m.x || prev.y !== m.y;
        let lastMoved = prev.lastMoved;
        let wasAfk = prev.isAfk;

        if (moved) {
          lastMoved = now;
          if (wasAfk) {
            changes.afkEnd.push(m.name);
            wasAfk = false;
          }
        } else if (m.isOnline && !wasAfk && (now - lastMoved) > 300000) {
          // 5 min sin moverse = AFK
          wasAfk = true;
          changes.afkStart.push(m.name);
        }

        this.teamState.set(steamId, {
          name: m.name,
          steamId,
          isOnline: m.isOnline,
          isAlive: m.isAlive,
          x: m.x,
          y: m.y,
          lastMoved,
          isAfk: wasAfk,
          deathCount: m.isAlive ? (prev.deathCount || 0) : (changes.died.find(d => d.name === m.name) ? (prev.deathCount || 0) + 1 : (prev.deathCount || 0)),
          spawnTime: (!prev.isAlive && m.isAlive) ? now : (prev.spawnTime || now),
        });
      } else {
        // Primera vez que vemos este miembro
        this.teamState.set(steamId, {
          name: m.name,
          steamId,
          isOnline: m.isOnline,
          isAlive: m.isAlive,
          x: m.x,
          y: m.y,
          lastMoved: now,
          isAfk: false,
          deathCount: 0,
          spawnTime: now,
        });
      }
    }

    return changes;
  }

  getAfkMembers() {
    return Array.from(this.teamState.values()).filter(m => m.isAfk && m.isOnline);
  }

  getOnlineMembers() {
    return Array.from(this.teamState.values()).filter(m => m.isOnline);
  }

  getOfflineMembers() {
    return Array.from(this.teamState.values()).filter(m => !m.isOnline);
  }

  getLongestAlive() {
    const alive = Array.from(this.teamState.values()).filter(m => m.isAlive && m.isOnline);
    if (alive.length === 0) return null;
    return alive.reduce((longest, m) => {
      return (m.spawnTime < longest.spawnTime) ? m : longest;
    });
  }

  getTeamPositions() {
    return Array.from(this.teamState.values()).filter(m => m.isOnline);
  }
}

// Utilidades de tiempo
function parseDuration(str) {
  let totalMs = 0;
  const hourMatch = str.match(/(\d+)\s*h/i);
  const minMatch = str.match(/(\d+)\s*m/i);
  const secMatch = str.match(/(\d+)\s*s/i);

  if (hourMatch) totalMs += parseInt(hourMatch[1]) * 3600000;
  if (minMatch) totalMs += parseInt(minMatch[1]) * 60000;
  if (secMatch) totalMs += parseInt(secMatch[1]) * 1000;

  // Si solo pusieron un numero, asumir minutos
  if (!hourMatch && !minMatch && !secMatch) {
    const num = parseInt(str);
    if (!isNaN(num)) totalMs = num * 60000;
  }

  return totalMs;
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`);
  return parts.join(' ') || '0s';
}

function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

module.exports = { BotState, parseDuration, formatDuration, calculateDistance };
