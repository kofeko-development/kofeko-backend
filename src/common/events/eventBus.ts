import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export type RealtimeEventPayloads = {
  'job:applications_updated': {
    tenantId: string;
    jobId: string;
  };
};

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // Allow multiple recruiters viewing dashboards concurrently
  }

  emitTyped<K extends keyof RealtimeEventPayloads>(event: K, payload: RealtimeEventPayloads[K]): boolean {
    logger.debug({ event, payload }, 'Emitting realtime event');
    return super.emit(event, payload);
  }

  onTyped<K extends keyof RealtimeEventPayloads>(event: K, listener: (payload: RealtimeEventPayloads[K]) => void): this {
    return super.on(event, listener);
  }

  offTyped<K extends keyof RealtimeEventPayloads>(event: K, listener: (payload: RealtimeEventPayloads[K]) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new EventBus();
