import { AsyncLocalStorage } from 'async_hooks';

if (!(globalThis as unknown as { AsyncLocalStorage?: typeof AsyncLocalStorage }).AsyncLocalStorage) {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
}
