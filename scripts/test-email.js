#!/usr/bin/env node

// Test email script
// This script will test the email service by sending a test email

import sgMail from "@sendgrid/mail";
import { config } from "dotenv";
// Let's create a simpler test that directly uses SendGrid
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Configure dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../.env") });

async function runTest() {
	try {
		console.log("Testing SendGrid email...");

		// Get the API key from environment
		const apiKey = process.env.SENDGRID_API_KEY;
		const fromEmail = process.env.SENDGRID_FROM_EMAIL;

		if (!apiKey) {
			console.error("SENDGRID_API_KEY is not set in environment variables");
			process.exit(1);
		}

		if (!fromEmail) {
			console.error("SENDGRID_FROM_EMAIL is not set in environment variables");
			process.exit(1);
		}

		// Check if API key or from email looks wrong - redact when printing
		const isApiKeyInFromEmailField = fromEmail.startsWith("SG.");
		const isEmailInApiKeyField = apiKey.includes("@");

		console.log(
			"API_KEY appears to be a valid SendGrid key:",
			!isEmailInApiKeyField,
		);
		console.log(
			"FROM_EMAIL appears to be a valid email address:",
			!isApiKeyInFromEmailField,
		);

		// Print partially redacted values for debugging
		console.log("FROM_EMAIL starts with:", fromEmail.substring(0, 5) + "...");

		if (isApiKeyInFromEmailField) {
			console.error(
				"ERROR: FROM_EMAIL appears to contain an API key, not an email address.",
			);
			console.error("Please check your environment variables.");
			process.exit(1);
		}

		if (isEmailInApiKeyField) {
			console.error(
				"ERROR: SENDGRID_API_KEY appears to contain an email address, not an API key.",
			);
			console.error("Please check your environment variables.");
			process.exit(1);
		}

		// Configure SendGrid
		sgMail.setApiKey(apiKey);

		// Create the email message
		const msg = {
			to: fromEmail, // Using the verified email as recipient
			from: fromEmail,
			subject: "Test Email from Brand Guidelines Application",
			text: "This is a test email to verify the SendGrid integration is working correctly.",
			html: "<strong>This is a test email to verify the SendGrid integration is working correctly.</strong>",
		};

		// Send the email
		console.log("Sending test email to:", fromEmail);
		const response = await sgMail.send(msg);

		console.log("Email sent successfully!");
		console.log("SendGrid response status:", response[0].statusCode);
	} catch (err) {
		console.error("Error during test:");
		console.error(err.response?.body?.errors || err.message || err);
		process.exit(1);
	}
}

// Run the test
runTest();
