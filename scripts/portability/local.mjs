import { localPortability } from '@runeditrun/rer/portability';
import { readSettings } from '@runeditrun/rer/adapter-settings';
import { RerError } from '@runeditrun/rer/errors';

// Restore authenticates ciphertext with the same private setting the application
// will use afterward. An ambient environment value cannot silently substitute it.
export function envelopePortability(secrets) {
  const native = localPortability({ database: 'foundation',
    policyModule: 'scripts/portability/policy.mjs', transient: ['local runtime caches and logs'] });
  return { ...native, async import(context) {
    let key;
    try { key = (await readSettings(context.root, secrets)).values.ENVELOPE_RECORD_KEY; }
    catch { throw new RerError('restore_refused', 'Restore refused (archive_record_key_unreadable): recover the private record key before importing.', 4); }
    if (typeof key !== 'string' || !/^[A-Za-z0-9+\/]{43}=$/.test(key) || Buffer.from(key, 'base64').toString('base64') !== key)
      throw new RerError('restore_refused', 'Restore refused (archive_record_key_required): recover the original private record key before importing.', 4);
    context.store.addSecrets([key]);
    const store = new Proxy(context.store, { get(target, property) {
      if (property === 'spawn') return (label, command, args, options = {}) => target.spawn(label, command, args,
        { ...options, env: { ...options.env, ENVELOPE_RECORD_KEY: key } });
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return native.import({ ...context, store });
  } };
}
