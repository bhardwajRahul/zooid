import type { FieldType, ResourceMapperField } from 'n8n-workflow';

type JsonSchemaProperty = {
	type?: string | string[];
	description?: string;
	enum?: unknown[];
	format?: string;
	default?: unknown;
};

type JsonSchema = {
	type?: string;
	properties?: Record<string, JsonSchemaProperty>;
	required?: string[];
};

function mapJsonSchemaType(prop: JsonSchemaProperty): FieldType {
	const t = Array.isArray(prop.type)
		? (prop.type.find((x) => x !== 'null') ?? 'string')
		: (prop.type ?? 'string');

	switch (t) {
		case 'integer':
		case 'number':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'array':
		case 'object':
			return 'object';
		default:
			if (prop.format === 'date-time' || prop.format === 'date') return 'dateTime';
			return 'string';
	}
}

export function jsonSchemaToResourceFields(schema: unknown): ResourceMapperField[] | null {
	if (!schema || typeof schema !== 'object') return null;

	const resolved = schema as JsonSchema;
	if (!resolved.properties) return null;

	const required = new Set(resolved.required ?? []);

	return Object.entries(resolved.properties).map(([key, prop]) => ({
		id: key,
		displayName: key,
		required: required.has(key),
		defaultMatch: false,
		display: true,
		type: mapJsonSchemaType(prop),
		defaultValue: (prop.default as string | number | boolean | null) ?? null,
	}));
}
