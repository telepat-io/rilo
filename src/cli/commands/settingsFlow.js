import { select, input, password, confirm } from '@inquirer/prompts';
import { SETTINGS, SECURE_SETTINGS, PUBLIC_SETTINGS } from '../../config/settingsSchema.js';
import {
  resolvePublicValue,
  resolveSecureStatus,
  readPublicConfig,
  savePublicSetting,
  saveSecureToken
} from '../../store/settingsStore.js';

const DONE_CHOICE = '__done__';
const CANCEL_CHOICE = '__cancel__';

// ── Display helpers ────────────────────────────────────────────────────────────

/**
 * Format a value for display next to a setting name.
 * Secure values are always masked; env-sourced values show an indicator.
 */
export function formatCurrentValue(setting, value, source) {
  if (setting.type === 'secure') {
    if (source === 'env') return '(set via environment variable — not editable here)';
    if (source === 'keystore') return '(stored securely)';
    return '(not set)';
  }
  if (source === 'env') return `${value}  ← from environment variable`;
  const display = value !== undefined && value !== null ? String(value) : String(setting.default);
  return source === 'default' ? `${display}  ← default` : display;
}

// ── Per-setting prompt ─────────────────────────────────────────────────────────

async function promptForSetting(setting, currentValue, source) {
  const isEnvOverridden = source === 'env';

  if (setting.type === 'secure') {
    if (isEnvOverridden) {
      console.log(
        `\n  ${setting.label}: This token is set via an environment variable and cannot be\n` +
        '  overridden here. Remove it from your environment / .env file first.\n'
      );
      return null; // nothing to do
    }

    const hasExisting = source === 'keystore';
    const action = await select({
      message: `${setting.label}${hasExisting ? ' (currently stored securely)' : ' (not set)'}`,
      choices: [
        { name: hasExisting ? 'Replace stored value' : 'Set value', value: 'set' },
        ...(hasExisting ? [{ name: 'Clear stored value', value: 'clear' }] : []),
        { name: 'Skip', value: 'skip' }
      ]
    });

    if (action === 'skip') return null;
    if (action === 'clear') return { key: setting.keystoreKey, value: '', clear: true };

    const value = await password({
      message: `Enter ${setting.label}:`,
      mask: '*',
      validate(v) {
        if (!v || !v.trim()) return 'Value must not be empty.';
        return true;
      }
    });

    return { key: setting.keystoreKey, value, secure: true };
  }

  // Public setting
  if (isEnvOverridden) {
    console.log(
      `\n  ${setting.label}: Currently set to "${currentValue}" via environment variable.\n` +
      '  rilo will use the env var value; any saved setting here will be ignored while\n' +
      '  the env var is set.\n'
    );
    const proceed = await confirm({
      message: 'Save a config.json value anyway (used when the env var is absent)?',
      default: false
    });
    if (!proceed) return null;
  }

  const defaultDisplay = String(currentValue ?? setting.default);
  const newValue = await input({
    message: `${setting.label}:`,
    default: defaultDisplay,
    validate(v) {
      if (setting.validate) return setting.validate(v);
      return true;
    }
  });

  // Coerce type
  const coerced = setting.type === 'number' ? Number(newValue) : newValue;
  return { key: setting.configKey, value: coerced, public: true };
}

// ── Main flow ─────────────────────────────────────────────────────────────────

export async function openSettings() {
  console.log('\n  rilo settings\n');

  const storedConfig = await readPublicConfig();

  // Resolve current state for all settings for menu display
  const stateMap = {};
  for (const s of SETTINGS) {
    if (s.type === 'secure') {
      const status = await resolveSecureStatus(s);
      stateMap[s.id] = { value: null, source: status.source };
    } else {
      const resolved = resolvePublicValue(s, storedConfig);
      stateMap[s.id] = resolved;
    }
  }

  const pendingChanges = []; // { setting, change }

  while (true) {
    // Build menu choices
    const choices = [
      { name: '─── Secure credentials ───', value: '__header_secure__', disabled: true },
      ...SECURE_SETTINGS.map((s) => {
        const { source } = stateMap[s.id];
        return {
          name: `${s.label}`,
          value: s.id,
          description: formatCurrentValue(s, null, source)
        };
      }),
      { name: '─── General settings ───', value: '__header_public__', disabled: true },
      ...PUBLIC_SETTINGS.map((s) => {
        const { value, source } = stateMap[s.id];
        return {
          name: `${s.label}`,
          value: s.id,
          description: formatCurrentValue(s, value, source)
        };
      }),
      { name: '──────────────────────────', value: '__sep__', disabled: true },
      ...(pendingChanges.length > 0
        ? [{ name: `✓ Save ${pendingChanges.length} change(s) and exit`, value: DONE_CHOICE }]
        : [{ name: '✓ Done (no changes)', value: DONE_CHOICE }]),
      { name: '✗ Cancel / Discard (Ctrl+C to quit)', value: CANCEL_CHOICE }
    ];

    const selected = await select({
      message: 'Select a setting to edit:',
      choices,
      pageSize: 20
    });

    if (selected === CANCEL_CHOICE) {
      console.log('\n  No changes saved.\n');
      return;
    }

    if (selected === DONE_CHOICE) break;

    const setting = SETTINGS.find((s) => s.id === selected) ?? null;
    if (!setting) continue;

    const { value, source } = stateMap[setting.id];
    const change = await promptForSetting(setting, value, source);

    if (change) {
      pendingChanges.push({ setting, change });
      // Update display state optimistically
      if (change.secure) {
        stateMap[setting.id] = { value: null, source: 'keystore' };
      } else if (change.clear) {
        stateMap[setting.id] = { value: null, source: 'none' };
      } else if (change.public) {
        stateMap[setting.id] = { value: change.value, source: 'config' };
      }
    }
  }

  if (pendingChanges.length === 0) {
    console.log('\n  No changes to save.\n');
    return;
  }

  // Persist all changes
  for (const { change } of pendingChanges) {
    if (change.secure) {
      await saveSecureToken(change.key, change.value);
    } else if (change.clear) {
      // Import deleteSecret lazily to avoid circular deps in tests
      const { deleteSecret } = await import('../../config/keystore.js');
      await deleteSecret(change.key);
    } else if (change.public) {
      await savePublicSetting(change.key, change.value);
    }
  }

  console.log(`\n  Saved ${pendingChanges.length} change(s) to ~/.rilo/config.json / keystore.\n`);
}
