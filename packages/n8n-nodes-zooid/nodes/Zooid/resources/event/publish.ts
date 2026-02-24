import type { INodeProperties } from 'n8n-workflow';

const showOnlyForEventPublish = {
	operation: ['publish'],
	resource: ['event'],
};

export const eventPublishDescription: INodeProperties[] = [
	{
		displayName: 'Event Type',
		name: 'eventType',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		displayOptions: {
			show: showOnlyForEventPublish,
		},
		description: 'Event type tag — channels with schemas will show available types',
		modes: [
			{
				displayName: 'From Schema',
				name: 'list',
				type: 'list',
				placeholder: 'Select an event type...',
				typeOptions: {
					searchListMethod: 'getEventTypes',
					searchable: true,
				},
			},
			{
				displayName: 'Custom',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. task-created',
			},
		],
		routing: {
			send: {
				type: 'body',
				property: 'type',
			},
		},
	},
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		displayOptions: {
			show: showOnlyForEventPublish,
		},
		options: [
			{
				name: 'Form Fields',
				value: 'fields',
				description: 'Fill in fields from the channel schema',
			},
			{
				name: 'Raw JSON',
				value: 'json',
				description: 'Provide the event data as raw JSON',
			},
		],
		default: 'fields',
		description: 'How to provide the event data',
	},
	{
		displayName: 'Event Fields',
		name: 'eventFields',
		type: 'resourceMapper',
		noDataExpression: true,
		displayOptions: {
			show: {
				...showOnlyForEventPublish,
				inputMode: ['fields'],
			},
		},
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		typeOptions: {
			resourceMapper: {
				resourceMapperMethod: 'getEventSchema',
				mode: 'add',
				fieldWords: {
					singular: 'field',
					plural: 'fields',
				},
				addAllFields: true,
				noFieldsError: 'No schema found for this channel — switch to Raw JSON mode.',
			},
		},
		routing: {
			send: {
				type: 'body',
				property: 'data',
				value: '={{$value.value}}',
			},
		},
	},
	{
		displayName: 'Event Data',
		name: 'data',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				...showOnlyForEventPublish,
				inputMode: ['json'],
			},
		},
		description: 'The JSON data payload for the event (max 64KB)',
		routing: {
			send: {
				type: 'body',
				property: 'data',
			},
		},
	},
];
