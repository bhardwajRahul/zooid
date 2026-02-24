import type { INodeProperties } from 'n8n-workflow';

const showOnlyForChannel = {
	resource: ['channel'],
};

export const channelDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForChannel,
		},
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'List all channels',
				description: 'List many channels on the server',
				routing: {
					request: {
						method: 'GET',
						url: '/api/v1/channels',
					},
					output: {
						postReceive: [
							{
								type: 'rootProperty',
								properties: {
									property: 'channels',
								},
							},
						],
					},
				},
			},
		],
		default: 'getAll',
	},
];
