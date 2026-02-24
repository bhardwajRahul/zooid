import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { zooidApiRequest } from '../shared/transport';

type ChannelResponse = {
	id: string;
	schema: Record<string, unknown> | null;
};

export async function getEventTypes(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const channelId = this.getCurrentNodeParameter('channelId', { extractValue: true }) as string;

	if (!channelId) {
		return { results: [] };
	}

	try {
		const response = await zooidApiRequest.call(this, 'GET', '/api/v1/channels');
		const channels: ChannelResponse[] = response.channels ?? response;
		const channel = channels.find((ch) => ch.id === channelId);

		if (!channel?.schema) {
			return { results: [] };
		}

		let results: INodeListSearchItems[] = Object.keys(channel.schema).map((type) => ({
			name: type,
			value: type,
		}));

		if (filter) {
			const lower = filter.toLowerCase();
			results = results.filter((r) => r.name.toLowerCase().includes(lower));
		}

		return { results };
	} catch {
		return { results: [] };
	}
}
