import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ZooidApi implements ICredentialType {
	name = 'zooidApi';

	displayName = 'Zooid API';

	icon: Icon = 'file:../icons/zooid-icon.svg';

	documentationUrl = 'https://zooid.dev/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: '',
			placeholder: 'https://your-instance.workers.dev',
			required: true,
			description: 'The base URL of your Zooid server',
		},
		{
			displayName: 'Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Publish or admin JWT token from your Zooid server',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.token}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serverUrl}}',
			url: '/.well-known/zooid.json',
			method: 'GET',
		},
	};
}
