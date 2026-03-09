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
    this.client.sendTeamMessage(message);
  }

  // --- Promote to Team Leader ---
  async promoteToLeader(steamId) {
    return new Promise((resolve, reject) => {
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
    });
  }

  // --- Event Polling (detectar eventos del mapa) ---
  startEventPolling() {
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
