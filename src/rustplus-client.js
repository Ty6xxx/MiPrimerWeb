const RustPlus = require('@liamcottle/rustplus.js');
const config = require('./config');
const EventEmitter = require('events');

class RustPlusClient extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.connected = false;
    this.reconnectInterval = 5000;
    this.previousMarkers = new Map();
  }

  connect() {
    const { serverIp, serverPort, playerId, playerToken } = config.rust;

    if (!serverIp || !serverPort || !playerId || !playerToken) {
      console.error('[Rust+] Faltan datos de conexion (IP, Puerto, PlayerID o Token).');
      return;
    }

    // Limpiar conexion anterior si existe
    this.stopEventPolling();
    this.connected = false;

    this.client = new RustPlus(serverIp, serverPort, playerId, playerToken);

    this.client.on('connecting', () => {
      console.log('[Rust+] Conectando al servidor...');
    });

    this.client.on('connected', () => {
      console.log('[Rust+] Conectado exitosamente!');
      this.connected = true;
      this.emit('ready');
      this.startEventPolling();
    });

    this.client.on('disconnected', () => {
      console.log('[Rust+] Desconectado. Reintentando en 5s...');
      this.connected = false;
      this.stopEventPolling();
      setTimeout(() => this.connect(), this.reconnectInterval);
    });

    this.client.on('error', (err) => {
      console.error('[Rust+] Error:', err.message);
    });

    this.client.on('message', (message) => {
      this.handleMessage(message);
    });

    this.client.connect();
  }

  handleMessage(message) {
    // Broadcast de cambio de entidad (Smart Devices)
    if (message.broadcast && message.broadcast.entityChanged) {
      const entity = message.broadcast.entityChanged;
      this.emit('entityChanged', {
        entityId: entity.entityId,
        value: entity.payload.value,
      });
    }

    // Mensajes de team chat
    if (message.broadcast && message.broadcast.teamMessage) {
      const teamMsg = message.broadcast.teamMessage.message;
      this.emit('teamMessage', {
        steamId: teamMsg.steamId.toString(),
        name: teamMsg.name,
        message: teamMsg.message,
        time: teamMsg.time,
      });
    }
  }

  // --- Server Info ---
  async getServerInfo() {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.getInfo((msg) => {
        if (msg.response && msg.response.info) {
          resolve(msg.response.info);
        } else {
          reject(new Error('No se pudo obtener info del servidor'));
        }
        return true;
      });
    });
  }

  // --- Time ---
  async getTime() {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.getTime((msg) => {
        if (msg.response && msg.response.time) {
          resolve(msg.response.time);
        } else {
          reject(new Error('No se pudo obtener la hora'));
        }
        return true;
      });
    });
  }

  // --- Team Info ---
  async getTeamInfo() {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.getTeamInfo((msg) => {
        if (msg.response && msg.response.teamInfo) {
          resolve(msg.response.teamInfo);
        } else {
          reject(new Error('No se pudo obtener info del equipo'));
        }
        return true;
      });
    });
  }

  // --- Map Markers (Vending, Cargo, Heli, etc.) ---
  async getMapMarkers() {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.getMapMarkers((msg) => {
        if (msg.response && msg.response.mapMarkers) {
          resolve(msg.response.mapMarkers.markers);
        } else {
          reject(new Error('No se pudo obtener marcadores'));
        }
        return true;
      });
    });
  }

  // --- Entity Info ---
  async getEntityInfo(entityId) {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.getEntityInfo(entityId, (msg) => {
        if (msg.response && msg.response.entityInfo) {
          resolve(msg.response.entityInfo);
        } else {
          reject(new Error(`No se pudo obtener info de entidad ${entityId}`));
        }
        return true;
      });
    });
  }

  // --- Smart Switch Control ---
  async turnOn(entityId) {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.turnSmartSwitchOn(entityId, (msg) => {
        if (msg.response) {
          resolve(true);
        } else {
          reject(new Error(`No se pudo encender entidad ${entityId}`));
        }
        return true;
      });
    });
  }

  async turnOff(entityId) {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      this.client.turnSmartSwitchOff(entityId, (msg) => {
        if (msg.response) {
          resolve(true);
        } else {
          reject(new Error(`No se pudo apagar entidad ${entityId}`));
        }
        return true;
      });
    });
  }

  // --- Team Chat ---
  sendTeamMessage(message) {
    if (!this.client || !this.connected) return;
    try {
      this.client.sendTeamMessage(message);
    } catch (err) {
      console.error('[Rust+] Error enviando mensaje:', err.message);
    }
  }

  /**
   * Envia un mensaje al team chat del juego, limpiando markdown/emojis
   * y dividiendo en chunks de 128 chars si es necesario.
   * @param {string} text  Texto a enviar (puede tener saltos de linea)
   * @param {number} delay Milisegundos entre mensajes (default 1500)
   */
  sendGameMessage(text, delay = 1500) {
    if (!this.client || !this.connected) return;

    // Limpiar markdown y emojis; conservar solo ASCII imprimible
    const clean = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/[^\x20-\x7E\n]/g, '') // solo ASCII imprimible + salto de linea
      .trim();

    // Dividir por lineas primero, luego por longitud (max 128 chars)
    const MAX = 128;
    const chunks = [];
    for (const line of clean.split('\n')) {
      if (line.length === 0) continue;
      if (line.length <= MAX) {
        chunks.push(line);
      } else {
        // Dividir lineas largas en palabras
        const words = line.split(' ');
        let current = '';
        for (const word of words) {
          if ((current + (current ? ' ' : '') + word).length > MAX) {
            if (current) chunks.push(current);
            current = word.slice(0, MAX);
          } else {
            current = current ? `${current} ${word}` : word;
          }
        }
        if (current) chunks.push(current);
      }
    }

    // Limitar a 5 chunks para no spamear
    const toSend = chunks.slice(0, 5);
    toSend.forEach((chunk, i) => {
      setTimeout(() => this.sendTeamMessage(chunk), i * delay);
    });
  }

  // --- Promote to Team Leader ---
  async promoteToLeader(steamId) {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    return new Promise((resolve, reject) => {
      try {
        this.client.sendRequest({
          promoteToLeader: { steamId: BigInt(steamId) },
        }, (msg) => {
          if (msg.response) {
            resolve(true);
          } else {
            reject(new Error('No se pudo cambiar el lider'));
          }
          return true;
        });
      } catch (err) {
        reject(new Error(`Error al promover lider: ${err.message}`));
      }
    });
  }

  // --- Event Polling (detectar eventos del mapa) ---
  startEventPolling() {
    this.stopEventPolling();
    this.eventPollTimer = setInterval(async () => {
      try {
        const markers = await this.getMapMarkers();
        this.detectEvents(markers);
      } catch (err) {
        // Silenciar errores de polling
      }
    }, 10000); // Cada 10 segundos (como el bot de referencia)
  }

  stopEventPolling() {
    if (this.eventPollTimer) {
      clearInterval(this.eventPollTimer);
      this.eventPollTimer = null;
    }
  }

  detectEvents(markers) {
    const currentIds = new Set();

    for (const marker of markers) {
      const key = `${marker.type}-${marker.id}`;
      currentIds.add(key);

      if (!this.previousMarkers.has(key)) {
        // Nuevo evento detectado
        const eventName = this.getMarkerTypeName(marker.type);
        if (eventName) {
          this.emit('gameEvent', {
            type: eventName,
            marker: marker,
          });
        }
      }
    }

    // Detectar eventos que desaparecieron
    for (const [key, marker] of this.previousMarkers) {
      if (!currentIds.has(key)) {
        const eventName = this.getMarkerTypeName(marker.type);
        if (eventName) {
          this.emit('gameEventEnd', {
            type: eventName,
            marker: marker,
          });
        }
      }
    }

    // Actualizar marcadores previos
    this.previousMarkers.clear();
    for (const marker of markers) {
      const key = `${marker.type}-${marker.id}`;
      this.previousMarkers.set(key, marker);
    }
  }

  getMarkerTypeName(type) {
    // Solo emitir eventos relevantes (no Player, VendingMachine, GenericRadius)
    const types = {
      2: 'Explosion',
      4: 'CH47 (Chinook)',
      5: 'CargoShip',
      6: 'Crate',
      8: 'PatrolHelicopter',
    };
    return types[type] || null;
  }

  // --- Buscar items en Vending Machines ---
  async searchVending(itemName) {
    if (!this.client || !this.connected) throw new Error('No conectado a Rust+');
    const markers = await this.getMapMarkers();
    const vendingMarkers = markers.filter((m) => m.type === 3); // VendingMachine
    const results = [];

    for (const vm of vendingMarkers) {
      if (vm.sellOrders && vm.sellOrders.length > 0) {
        for (const order of vm.sellOrders) {
          const name = order.itemId?.toString() || 'Unknown';
          if (
            name.toLowerCase().includes(itemName.toLowerCase()) ||
            (order.currencyId &&
              order.currencyId.toString().includes(itemName))
          ) {
            results.push({
              location: { x: vm.x, y: vm.y },
              name: vm.name || 'Vending Machine',
              item: name,
              quantity: order.quantity,
              costPerItem: order.costPerItem,
              currencyId: order.currencyId,
              amountInStock: order.amountInStock,
            });
          }
        }
      }
    }
    return results;
  }
}

module.exports = RustPlusClient;
