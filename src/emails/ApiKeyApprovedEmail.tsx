import { CodeInline, Heading, Text } from "react-email";

import { EmailLayout } from "./email-layout";

type ApiKeyApprovedEmailProps = {
	firstName: string;
	apiKey: string;
};

export function ApiKeyApprovedEmail({ firstName, apiKey }: ApiKeyApprovedEmailProps) {
	return (
		<EmailLayout preview="Your Platinum Gold API access has been approved">
			<Heading as="h1" style={headingStyle}>Your API access is approved</Heading>
			<Text style={textStyle}>Hi {firstName},</Text>
			<Text style={textStyle}>Your Platinum Gold API key is:</Text>
			<Text style={keyStyle}><CodeInline>{apiKey}</CodeInline></Text>
			<Text style={textStyle}>
				Send it in the <CodeInline>X-API-Key</CodeInline> header. Keep it on your server and
				never include it in a public browser bundle, repository, or screenshot.
			</Text>
		</EmailLayout>
	);
}

const headingStyle = { fontSize: "28px", lineHeight: "34px", margin: "0 0 24px" };
const textStyle = { fontSize: "16px", lineHeight: "26px", margin: "0 0 16px" };
const keyStyle = {
	backgroundColor: "#201a14",
	color: "#f0cf78",
	fontSize: "15px",
	lineHeight: "24px",
	margin: "20px 0",
	overflowWrap: "anywhere" as const,
	padding: "16px",
};
