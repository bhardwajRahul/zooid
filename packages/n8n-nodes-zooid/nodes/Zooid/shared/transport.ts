import type {
	IHookFunctions,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';

export async function zooidApiRequest(
	this: IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body: IDataObject | undefined = undefined,
) {
	const credentials = await this.getCredentials('zooidApi');
	const serverUrl = (credentials.serverUrl as string).replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		qs,
		body,
		url: `${serverUrl}${path}`,
		json: true,
	};

	return this.helpers.httpRequestWithAuthentication.call(this, 'zooidApi', options);
}
