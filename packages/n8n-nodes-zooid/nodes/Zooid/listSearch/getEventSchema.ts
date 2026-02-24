import type { ILoadOptionsFunctions, ResourceMapperFields } from 'n8n-workflow';
import { zooidApiRequest } from '../shared/transport';
import { jsonSchemaToResourceFields } from '../shared/schemaMapper';

type ChannelResponse = {
	id: string;
	schema: Record<string, unknown> | null;
	strict: boolean;
};

export async function getEventSchema(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
	const channelId = this.getCurrentNodeParameter('channelId', { extractValue: true }) as string;
	const eventType = this.getCurrentNodeParameter('eventType', { extractValue: true }) as string;

	if (!channelId) {
		return { fields: [] };
	}

	try {
		const response = await zooidApiRequest.call(this, 'GET', '/api/v1/channels');
		const channels: ChannelResponse[] = response.channels ?? response;
		const channel = channels.find((ch) => ch.id === channelId);

		if (!channel?.schema) {
			return { fields: [] };
		}

		// Get the schema for the specific event type, or the first one
		const schemaKey = eventType || Object.keys(channel.schema)[0];
		const typeSchema = schemaKey ? channel.schema[schemaKey] : null;

		if (!typeSchema) {
			return { fields: [] };
		}

		const fields = jsonSchemaToResourceFields(typeSchema);

		if (!fields || fields.length === 0) {
			return { fields: [] };
		}

		return {
			fields,
			emptyFieldsNotice: channel.strict
				? 'This channel enforces a strict schema — all required fields must be provided.'
				: undefined,
		};
	} catch {
		return { fields: [] };
	}
}
