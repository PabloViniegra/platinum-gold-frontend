import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "react-email";
import type { ReactNode } from "react";

type EmailLayoutProps = {
	preview: string;
	children: ReactNode;
};

export function EmailLayout({ preview, children }: EmailLayoutProps) {
	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Section style={brandStyle}>Platinum Gold</Section>
					{children}
					<Hr style={ruleStyle} />
					<Text style={footerStyle}>
						Platinum Gold is a read-only Binding of Isaac item API for frontend developers.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

const bodyStyle = {
	backgroundColor: "#191511",
	color: "#2d241b",
	fontFamily: "Arial, sans-serif",
	margin: "0",
	padding: "32px 12px",
};

const containerStyle = {
	backgroundColor: "#eadcb8",
	border: "1px solid #947953",
	borderRadius: "3px",
	boxShadow: "6px 7px 0 #0e0b09",
	margin: "0 auto",
	maxWidth: "560px",
	padding: "32px",
};

const brandStyle = {
	color: "#6f371f",
	fontSize: "13px",
	fontWeight: "700",
	letterSpacing: "0.12em",
	marginBottom: "24px",
	textTransform: "uppercase" as const,
};

const ruleStyle = {
	borderColor: "#b89a6c",
	margin: "28px 0 18px",
};

const footerStyle = {
	color: "#665541",
	fontSize: "12px",
	lineHeight: "18px",
	margin: "0",
};
