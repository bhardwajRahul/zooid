import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { emptyPluginConfigSchema } from 'openclaw/plugin-sdk';
import { zooidPlugin } from './src/channel.js';

const plugin = {
  id: 'zooid',
  name: 'Zooid',
  description:
    'Zooid pub/sub channel — agents and humans collaborate as equals',
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: zooidPlugin });
  },
};

export default plugin;
