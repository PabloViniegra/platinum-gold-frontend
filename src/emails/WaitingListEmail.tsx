import { Heading, Text } from "react-email";

import { EmailLayout } from "./email-layout";

type WaitingListEmailProps = {
	firstName: string;
};

export function WaitingListEmail({ firstName }: WaitingListEmailProps) {
	return (
		<EmailLayout preview="Your Platinum Gold API request is in the queue">
			<Heading as="h1" style={headingStyle}>Your request is in the queue</Heading>
			<Text style={textStyle}>Hi {firstName},</Text>
			<Text style={textStyle}>
				We received your request for access to the Platinum Gold API. Requests are reviewed
				manually, so joining the queue does not guarantee access.
			</Text>
			<Text style={textStyle}>
				If access is approved, we will send your API key to this email address. You do not
				need to submit another request.
			</Text>
		</EmailLayout>
	);
}

const headingStyle = {
	fontSize: "28px",
	lineHeight: "34px",
	margin: "0 0 24px",
};

const textStyle = {
	fontSize: "16px",
	lineHeight: "26px",
	margin: "0 0 16px",
};
