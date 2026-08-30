import { Heading, Text } from "react-email";

import { EmailLayout } from "./email-layout";
import { API_KEY_USE_CASE, type ApiKeyRequest, type ApiKeyUseCase } from "../lib/api-key-requests/contracts";

type AdminRequestEmailProps = {
	request: ApiKeyRequest;
	requestId: string;
};

type DetailProps = {
	label: string;
	value: string;
};

function useCaseLabel(useCase: ApiKeyUseCase): string {
	switch (useCase) {
		case API_KEY_USE_CASE.PERSONAL_PROJECT:
			return "Personal project";
		case API_KEY_USE_CASE.RESEARCH:
			return "Research";
		case API_KEY_USE_CASE.EDUCATION:
			return "Education";
		case API_KEY_USE_CASE.COMMERCIAL_EVALUATION:
			return "Commercial evaluation";
		case API_KEY_USE_CASE.OTHER:
			return "Other";
	}
}

function Detail({ label, value }: DetailProps) {
	return <Text style={detailStyle}><strong>{label}:</strong> {value}</Text>;
}

export function AdminRequestEmail({ request, requestId }: AdminRequestEmailProps) {
	return (
		<EmailLayout preview={`New API access request from ${request.firstName} ${request.lastName}`}>
			<Heading as="h1" style={headingStyle}>New API access request</Heading>
			<Detail label="Name" value={`${request.firstName} ${request.lastName}`} />
			<Detail label="Email" value={request.email} />
			<Detail label="Country" value={request.country} />
			<Detail label="Occupation" value={request.occupation} />
			<Detail label="Use case" value={useCaseLabel(request.useCase)} />
			{request.useCaseDetails && <Detail label="Details" value={request.useCaseDetails} />}
			<Detail label="Request ID" value={requestId} />
		</EmailLayout>
	);
}

const headingStyle = {
	fontSize: "28px",
	lineHeight: "34px",
	margin: "0 0 24px",
};

const detailStyle = {
	fontSize: "15px",
	lineHeight: "23px",
	margin: "0 0 9px",
};
