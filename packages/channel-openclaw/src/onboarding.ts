import type { OpenClawConfig } from 'openclaw/plugin-sdk';
import type { ZooidChannelConfig } from './types.js';

const CHANNEL_ID = 'zooid' as const;
const DEFAULT_ACCOUNT_ID = 'default';

/**
 * Minimal WizardPrompter shape — matches OpenClaw's wizard/prompts.ts interface.
 */
type WizardPrompter = {
  text: (params: {
    message: string;
    placeholder?: string;
    initialValue?: string;
    validate?: (value: unknown) => string | undefined;
  }) => Promise<string>;
  confirm: (params: {
    message: string;
    initialValue?: boolean;
  }) => Promise<boolean>;
  note: (message: string, title?: string) => Promise<void>;
};

type OnboardingStatusContext = {
  cfg: OpenClawConfig;
};

type OnboardingConfigureContext = {
  cfg: OpenClawConfig;
  prompter: WizardPrompter;
};

function getZooidSection(cfg: OpenClawConfig): ZooidChannelConfig | undefined {
  const channels = (cfg as Record<string, unknown>).channels as
    | { zooid?: ZooidChannelConfig }
    | undefined;
  return channels?.zooid;
}

function isConfigured(cfg: OpenClawConfig): boolean {
  const section = getZooidSection(cfg);
  if (!section) return false;
  const serverUrl = (section.serverUrl ?? '').trim();
  const token = (section.token ?? '').trim();
  const envToken = (process.env.ZOOID_TOKEN ?? '').trim();
  return Boolean(serverUrl && (token || envToken));
}

export const zooidOnboardingAdapter = {
  channel: CHANNEL_ID,

  getStatus: async ({ cfg }: OnboardingStatusContext) => {
    const configured = isConfigured(cfg);
    return {
      channel: CHANNEL_ID,
      configured,
      statusLines: [
        `Zooid: ${configured ? 'configured' : 'needs server URL + token'}`,
      ],
      selectionHint: configured ? 'configured' : 'needs server URL + token',
      quickstartScore: configured ? 1 : 0,
    };
  },

  configure: async ({ cfg, prompter }: OnboardingConfigureContext) => {
    let next = { ...cfg } as OpenClawConfig;
    const section = getZooidSection(next);

    await prompter.note(
      [
        'Zooid needs a server URL and an auth token.',
        'Get a token: npx zooid token mint --scope pub:* --scope sub:* --sub my-agent --name MyAgent',
        'Docs: https://github.com/zooid-ai/zooid',
      ].join('\n'),
      'Zooid setup',
    );

    const serverUrl = (
      await prompter.text({
        message: 'Zooid server URL',
        placeholder: 'https://your-zooid.workers.dev',
        initialValue: section?.serverUrl || undefined,
        validate: (value) => {
          const v = String(value ?? '').trim();
          if (!v) return 'Required';
          if (!v.startsWith('http://') && !v.startsWith('https://'))
            return 'Must start with http:// or https://';
          return undefined;
        },
      })
    ).trim();

    const envToken = (process.env.ZOOID_TOKEN ?? '').trim();
    let useEnv = false;
    let token = '';

    if (envToken) {
      useEnv = await prompter.confirm({
        message: 'ZOOID_TOKEN detected in environment. Use env var?',
        initialValue: true,
      });
    }

    if (!useEnv) {
      token = (
        await prompter.text({
          message: 'Zooid auth token',
          initialValue: section?.token || undefined,
          validate: (value) =>
            String(value ?? '').trim() ? undefined : 'Required',
        })
      ).trim();
    }

    const defaultPublishChannel = (
      await prompter.text({
        message: 'Default publish channel (optional)',
        placeholder: 'agent-output',
        initialValue: section?.defaultPublishChannel || undefined,
      })
    ).trim();

    const channels = (next as Record<string, unknown>).channels as
      | Record<string, unknown>
      | undefined;
    const zooid = channels?.zooid as ZooidChannelConfig | undefined;
    next = {
      ...next,
      channels: {
        ...channels,
        zooid: {
          ...zooid,
          enabled: true,
          serverUrl,
          ...(useEnv ? {} : { token }),
          ...(defaultPublishChannel ? { defaultPublishChannel } : {}),
        },
      },
    } as OpenClawConfig;

    await prompter.note(
      [
        'Next: restart the gateway and verify with status --probe.',
        "The agent will auto-discover channels from the token's scopes.",
      ].join('\n'),
      'Zooid next steps',
    );

    return { cfg: next };
  },

  disable: (cfg: OpenClawConfig) => {
    const channels = (cfg as Record<string, unknown>).channels as
      | Record<string, unknown>
      | undefined;
    const zooid = channels?.zooid as ZooidChannelConfig | undefined;
    return {
      ...cfg,
      channels: {
        ...channels,
        zooid: {
          ...zooid,
          enabled: false,
        },
      },
    } as OpenClawConfig;
  },
};
