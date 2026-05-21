import { workerData, parentPort } from 'worker_threads';
import { decryptBundle } from './crypto';

const { bundleJson, password } = workerData as { bundleJson: string; password: string };

decryptBundle(bundleJson, password)
  .then(result => parentPort!.postMessage(result))
  .catch(err => parentPort!.postMessage({
    ok: false,
    error: err instanceof Error ? err.message : 'Worker error',
  }));
