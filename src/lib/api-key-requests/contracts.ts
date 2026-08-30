export const API_KEY_USE_CASE = {
	PERSONAL_PROJECT: "personal_project",
	RESEARCH: "research",
	EDUCATION: "education",
	COMMERCIAL_EVALUATION: "commercial_evaluation",
	OTHER: "other",
} as const;

export type ApiKeyUseCase = (typeof API_KEY_USE_CASE)[keyof typeof API_KEY_USE_CASE];

type ApiKeyRequestPayload = {
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: string;
	useCaseDetails?: string;
	website?: string;
};

export type ApiKeyRequest = {
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: ApiKeyUseCase;
	useCaseDetails: string | null;
	honeypotTriggered: boolean;
};

const ALLOWED_FIELDS = new Set([
	"firstName",
	"lastName",
	"email",
	"country",
	"occupation",
	"useCase",
	"useCaseDetails",
	"website",
]);

function boundedText(value: string, maximumLength: number): string | null {
	if (value?.constructor !== String) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 && trimmed.length <= maximumLength ? trimmed : null;
}

function optionalText(value: string | undefined, maximumLength: number): string | null {
	if (value === undefined) return null;
	return boundedText(value, maximumLength);
}

function honeypotText(value: string | undefined): string | null {
	if (value === undefined) return "";
	if (value?.constructor !== String) return null;
	const trimmed = value.trim();
	return trimmed.length <= 500 ? trimmed : null;
}

export function parseApiKeyUseCase(value: string): ApiKeyUseCase | null {
	switch (value) {
		case API_KEY_USE_CASE.PERSONAL_PROJECT:
			return API_KEY_USE_CASE.PERSONAL_PROJECT;
		case API_KEY_USE_CASE.RESEARCH:
			return API_KEY_USE_CASE.RESEARCH;
		case API_KEY_USE_CASE.EDUCATION:
			return API_KEY_USE_CASE.EDUCATION;
		case API_KEY_USE_CASE.COMMERCIAL_EVALUATION:
			return API_KEY_USE_CASE.COMMERCIAL_EVALUATION;
		case API_KEY_USE_CASE.OTHER:
			return API_KEY_USE_CASE.OTHER;
		default:
			return null;
	}
}

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function parseApiKeyRequest(body: string): ApiKeyRequest | null {
	try {
		const payload: ApiKeyRequestPayload = JSON.parse(body);
		if (payload === null
			|| payload.constructor !== Object
			|| !Object.keys(payload).every((key) => ALLOWED_FIELDS.has(key))) {
			return null;
		}

		const firstName = boundedText(payload.firstName, 80);
		const lastName = boundedText(payload.lastName, 100);
		const email = boundedText(payload.email, 254);
		const country = boundedText(payload.country, 100);
		const occupation = boundedText(payload.occupation, 120);
		const useCase = parseApiKeyUseCase(payload.useCase);
		const useCaseDetails = optionalText(payload.useCaseDetails, 1_000);
		const website = honeypotText(payload.website);

		if (!firstName
			|| !lastName
			|| !email
			|| !country
			|| !occupation
			|| !useCase
			|| !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
			|| website === null
			|| useCase === API_KEY_USE_CASE.OTHER && useCaseDetails === null) {
			return null;
		}

		return {
			firstName,
			lastName,
			email,
			country,
			occupation,
			useCase,
			useCaseDetails: useCase === API_KEY_USE_CASE.OTHER ? useCaseDetails : null,
			honeypotTriggered: website.length > 0,
		};
	} catch {
		return null;
	}
}
