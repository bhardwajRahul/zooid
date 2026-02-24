import type { INodeProperties } from 'n8n-workflow';
import { eventPublishDescription } from './publish';

const showOnlyForEvent = {
	resource: ['event'],
};

export const eventDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForEvent,
		},
		options: [
			{
				name: 'Publish',
				value: 'publish',
				action: 'Publish an event to a channel',
				description: 'Publish a JSON event to a Zooid channel',
				routing: {
					request: {
						method: 'POST',
						url: '=/api/v1/channels/{{$parameter.channelId}}/events',
					},
				},
			},
		],
		default: 'publish',
	},
	{
		displayName: 'Channel',
		name: 'channelId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForEvent,
		},
		description: 'The channel to publish to',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a channel...',
				typeOptions: {
					searchListMethod: 'getChannels',
					searchable: true,
				},
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. clickup-tasks',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$',
							errorMessage:
								'Channel ID must be 3-64 chars: lowercase letters, numbers, and hyphens',
						},
					},
				],
			},
		],
	},
	...eventPublishDescription,
];
