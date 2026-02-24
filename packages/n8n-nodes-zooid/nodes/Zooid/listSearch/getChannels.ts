import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { zooidApiRequest } from '../shared/transport';

type Channel = {
	id: string;
	name: string;
	description: string | null;
	is_public: boolean;
	strict: boolean;
	event_count: number;
};

export async function getChannels(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	let channels: Channel[] = [];

	try {
		const response = await zooidApiRequest.call(this, 'GET', '/api/v1/channels');
		channels = response.channels ?? response;
	} catch {
		// token may not have permission to list channels
	}

	let results: INodeListSearchItems[] = channels.map((ch) => ({
		name: ch.name || ch.id,
		value: ch.id,
		url: ch.description ?? undefined,
	}));

	if (filter) {
		const lower = filter.toLowerCase();
		results = results.filter(
			(r) =>
				r.name.toLowerCase().includes(lower) || r.value.toString().toLowerCase().includes(lower),
		);
	}

	return { results };
}
