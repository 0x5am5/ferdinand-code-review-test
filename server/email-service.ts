import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { Client as PostmarkClient } from "postmark";
import { EmailServiceError, parsePostmarkError } from "./utils/errorResponse";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Email service that sends emails via Postmark
 * Falls back to generating email files in development if Postmark API token is not available
 */
export class EmailService {
  private emailDir: string;
  private usePostmark: boolean;
  private postmarkClient?: PostmarkClient;

  constructor() {
    // Check if Postmark API token is available
    const apiToken = process.env.POSTMARK_API_TOKEN;
    this.usePostmark = !!apiToken;

    if (this.usePostmark) {
      this.postmarkClient = new PostmarkClient(apiToken!);
      console.log(
        "Postmark API token detected. Using Postmark for email delivery.",
      );
    } else {
      console.log(
        "No Postmark API token found. Emails will be saved to files instead of being sent.",
      );
    }

    // Create a directory for storing generated emails (fallback mode)
    this.emailDir = path.join(process.cwd(), "generated-emails");
    if (!fs.existsSync(this.emailDir)) {
      fs.mkdirSync(this.emailDir, { recursive: true });
    }
  }

  /**
   * Send an email using Postmark or fallback to file-based simulation
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Create HTML email content if not provided
      const htmlContent =
        options.html ||
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${options.subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #0f172a; color: white; padding: 10px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .footer { text-align: center; padding: 10px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${options.subject}</h2>
            </div>
            <div class="content">
              ${options.text.replace(/\n/g, "<br>")}
            </div>
            <div class="footer">
              <p>This is a system-generated email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // If Postmark is available, send the email via the API
      if (this.usePostmark && this.postmarkClient) {
        try {
          const fromEmail =
            process.env.POSTMARK_FROM_EMAIL || "noreply@brandguidelines.com";
          console.log(`[EMAIL] Using sender email: ${fromEmail}`);

          console.log(
            `[EMAIL] Sending via Postmark to: ${options.to}, from: ${fromEmail}`,
          );
          const response = await this.postmarkClient.sendEmail({
            From: fromEmail,
            To: options.to,
            Subject: options.subject,
            TextBody: options.text,
            HtmlBody: htmlContent,
          });

          console.log(`[EMAIL] Postmark response:`, response);
          console.log(`\n📧 =============================================`);
          console.log(`📧 EMAIL SENT VIA POSTMARK`);
          console.log(`📧 To: ${options.to}`);
          console.log(`📧 Subject: ${options.subject}`);
          console.log(`📧 Message ID: ${response.MessageID}`);
          console.log(`📧 =============================================\n`);

          return true;
        } catch (error) {
          const postmarkError = error as any;
          console.error("[EMAIL] Postmark error:", postmarkError);

          // Parse the Postmark error and throw a structured error
          const { message, code, details } = parsePostmarkError(postmarkError);
          throw new EmailServiceError(message, code, details);
        }
      } else {
        // Fallback: Write the email to a file
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `${timestamp}_${options.to.replace("@", "_at_")}.html`;
        const filepath = path.join(this.emailDir, filename);

        await util.promisify(fs.writeFile)(filepath, htmlContent);

        console.log(`\n📧 =============================================`);
        console.log(`📧 EMAIL SENT (SIMULATED - DEVELOPMENT ONLY)`);
        console.log(`📧 To: ${options.to}`);
        console.log(`📧 Subject: ${options.subject}`);
        console.log(`📧 Saved to: ${filepath}`);
        console.log(`📧 =============================================\n`);

        return true;
      }
    } catch (error: unknown) {
      console.error("Failed to send email:", error);
      // Re-throw structured errors so they can be handled by the caller
      if (error instanceof EmailServiceError) {
        throw error;
      }
      // For unexpected errors, wrap them
      throw new EmailServiceError(
        "Failed to send email due to an unexpected error.",
        "EMAIL_SERVICE_FAILED",
        { originalError: error },
      );
    }
  }

  /**
   * Send an invitation email with a link
   * @throws {EmailServiceError} When email sending fails
   */
  async sendInvitationEmail({
    to,
    inviteLink,
    clientName = "our platform",
    role = "user",
    expiration = "7 days",
    logoUrl,
  }: {
    to: string;
    inviteLink: string;
    clientName?: string;
    role?: string;
    expiration?: string;
    logoUrl?: string;
  }): Promise<boolean> {
    const subject = `You've been invited to join ${clientName}`;

    // Create text version
    const text = `
      Hello,
      
      You've been invited to join ${clientName} as a ${role}.
      
      Please click the following link to accept your invitation:
      ${inviteLink}
      
      This invitation will expire in ${expiration}.
      
      If you have any questions, please contact the person who sent you this invitation.
    `;

    // Create HTML version
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { padding: 20px; text-align: center; }
          .logo { max-height: 80px; max-width: 200px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${clientName} logo" class="logo">` : ""}
            <h2>${subject}</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You've been invited to join <strong>${clientName}</strong> as a <strong>${role}</strong>.</p>
            <p>Please click the button below to accept your invitation:</p>
            <p style="text-align: center;">
              <a href="${inviteLink}" class="button">Accept Invitation</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This invitation will expire in ${expiration}.</p>
            <p>If you have any questions, please contact the person who sent you this invitation.</p>
          </div>
          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // sendEmail now throws EmailServiceError on failure, so we don't need to handle boolean returns
    await this.sendEmail({
      to,
      subject,
      text,
      html,
    });
    return true;
  }

  /**
   * Send a "resend invitation" email
   */
  async resendInvitationEmail({
    to,
    inviteLink,
    clientName = "our platform",
    role = "user",
    expiration = "7 days",
    logoUrl,
  }: {
    to: string;
    inviteLink: string;
    clientName?: string;
    role?: string;
    expiration?: string;
    logoUrl?: string;
  }): Promise<boolean> {
    const subject = `Reminder: Your invitation to join ${clientName}`;

    // Create text version
    const text = `
      Hello,
      
      This is a reminder about your invitation to join ${clientName} as a ${role}.
      
      Please click the following link to accept your invitation:
      ${inviteLink}
      
      This invitation will expire in ${expiration}.
      
      If you have any questions, please contact the person who sent you this invitation.
    `;

    // Create HTML version with similar styling to the invitation email
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { padding: 20px; text-align: center; }
          .logo { max-height: 80px; max-width: 200px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${clientName} logo" class="logo">` : ""}
            <h2>${subject}</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>This is a reminder about your invitation to join <strong>${clientName}</strong> as a <strong>${role}</strong>.</p>
            <p>Please click the button below to accept your invitation:</p>
            <p style="text-align: center;">
              <a href="${inviteLink}" class="button">Accept Invitation</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;"><a href="${inviteLink}">${inviteLink}</a></p>
            <p>This invitation will expire in ${expiration}.</p>
            <p>If you have any questions, please contact the person who sent you this invitation.</p>
          </div>
          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // sendEmail now throws EmailServiceError on failure, so we don't need to handle boolean returns
    await this.sendEmail({
      to,
      subject,
      text,
      html,
    });
    return true;
  }

  /**
   * Send a password reset email with a link
   */
  async sendPasswordResetEmail({
    to,
    resetLink,
    clientName = "our platform",
    expiration = "24 hours",
    logoUrl,
  }: {
    to: string;
    resetLink: string;
    clientName?: string;
    expiration?: string;
    logoUrl?: string;
  }): Promise<boolean> {
    console.log(`[PASSWORD RESET] sendPasswordResetEmail called for ${to}`);
    console.log(`[PASSWORD RESET] Reset link: ${resetLink}`);

    const subject = `Reset your password for ${clientName}`;

    // Create text version
    const text = `
      Hello,
      
      We received a request to reset your password for ${clientName}.
      
      Please click the following link to reset your password:
      ${resetLink}
      
      This link will expire in ${expiration}.
      
      If you did not request a password reset, please ignore this email or contact support if you have concerns.
    `;

    // Create HTML version
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { padding: 20px; text-align: center; }
          .logo { max-height: 80px; max-width: 200px; }
          .content { padding: 20px; background-color: #f9f9f9; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0f172a; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="${clientName} logo" class="logo">` : ""}
            <h2>${subject}</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your password for <strong>${clientName}</strong>.</p>
            <p>Please click the button below to reset your password:</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;"><a href="${resetLink}">${resetLink}</a></p>
            <p>This link will expire in ${expiration}.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>This is a system-generated email. Please do not reply to this message.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log(
      "[PASSWORD RESET] Sending password reset email with subject:",
      subject,
    );

    try {
      await this.sendEmail({
        to,
        subject,
        text,
        html,
      });

      console.log(`[PASSWORD RESET] Email sending result: Success`);
      return true;
    } catch (error: unknown) {
      console.error(
        "[PASSWORD RESET] Error sending password reset email:",
        error,
      );
      // Re-throw the EmailServiceError so it can be handled by the caller
      if (error instanceof EmailServiceError) {
        throw error;
      }
      // Wrap unexpected errors
      throw new EmailServiceError(
        "Failed to send password reset email.",
        "EMAIL_SERVICE_FAILED",
        { originalError: error },
      );
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
