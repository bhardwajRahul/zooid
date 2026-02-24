import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { eventDescription } from './resources/event';
import { channelDescription } from './resources/channel';
import { getChannels } from './listSearch/getChannels';
import { getEventTypes } from './listSearch/getEventTypes';
import { getEventSchema } from './listSearch/getEventSchema';

export class Zooid implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Zooid',
		name: 'zooid',
		icon: 'file:../../icons/zooid-icon.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Publish events to Zooid pub/sub channels',
		defaults: {
			name: 'Zooid',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'zooidApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{$credentials.serverUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Event',
						value: 'event',
					},
					{
						name: 'Channel',
						value: 'channel',
					},
				],
				default: 'event',
			},
			...eventDescription,
			...channelDescription,
		],
	};

	methods = {
		listSearch: {
			getChannels,
			getEventTypes,
		},
		resourceMapping: {
			getEventSchema,
		},
	};
}
