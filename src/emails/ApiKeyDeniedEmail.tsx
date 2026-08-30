import { Heading, Text } from "react-email";

import { EmailLayout } from "./email-layout";

type ApiKeyDeniedEmailProps = {
	firstName: string;
};

export function ApiKeyDeniedEmail({ firstName }: ApiKeyDeniedEmailProps) {
	return (
		<EmailLayout preview="Your Platinum Gold API access request was not approved">
			<Heading as="h1" style={headingStyle}>Your request was not approved</Heading>
			<Text style={textStyle}>Hi {firstName},</Text>
			<Text style={textStyle}>
				We reviewed your request for Platinum Gold API access and are not able to grant a
				key at this time.
			</Text>
			<Text style={textStyle}>You do not need to reply to this email.</Text>
		</EmailLayout>
	);
}

const headingStyle = { fontSize: "28px", lineHeight: "34px", margin: "0 0 24px" };
const textStyle = { fontSize: "16px", lineHeight: "26px", margin: "0 0 16px" };
