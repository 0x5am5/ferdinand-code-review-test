import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Simple email service that generates email files in development
 * In production, this would be replaced with a real email service
 */
export class EmailService {
  private emailDir: string;
  
  constructor() {
    // Create a directory for storing generated emails
    this.emailDir = path.join(process.cwd(), 'generated-emails');
    if (!fs.existsSync(this.emailDir)) {
      fs.mkdirSync(this.emailDir, { recursive: true });
    }
  }
  
  /**
   * Send an email (simulated in development)
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}_${options.to.replace('@', '_at_')}.html`;
      const filepath = path.join(this.emailDir, filename);
      
      // Create HTML email content
      const htmlContent = options.html || `
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
              ${options.text.replace(/\n/g, '<br>')}
            </div>
            <div class="footer">
              <p>This is a system-generated email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Write the email to a file
      await util.promisify(fs.writeFile)(filepath, htmlContent);
      
      // Log email info
      console.log(`📧 Email sent (simulated)`);
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Saved to: ${filepath}`);
      
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
  
  /**
   * Send an invitation email with a link
   */
  async sendInvitationEmail({
    to,
    inviteLink,
    clientName = "our platform",
    role = "user",
    expiration = "7 days",
    logoUrl
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
            ${logoUrl ? `<img src="${logoUrl}" alt="${clientName} logo" class="logo">` : ''}
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
    
    return this.sendEmail({
      to,
      subject,
      text,
      html
    });
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
    logoUrl
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
            ${logoUrl ? `<img src="${logoUrl}" alt="${clientName} logo" class="logo">` : ''}
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
    
    return this.sendEmail({
      to,
      subject,
      text,
      html
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();