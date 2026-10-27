import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { env } from '../env.js';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@Injectable()
export class Mail {
  private readonly log = new Logger(Mail.name);
  private readonly transport = nodemailer.createTransport(env.SMTP_URL);

  /** Branded email with one button · failures are logged, never thrown (the DB write already happened) */
  async sendButton(to: string, subject: string, heading: string, body: string, cta: string, url: string) {
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f1a3a">
<p style="font-weight:800;font-size:20px;margin:0 0 16px">Connecta</p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(heading)}</h1>
<p style="color:#5b6584;line-height:1.6">${esc(body)}</p>
<p style="margin:24px 0"><a href="${esc(url)}" style="background:#1d5cf5;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">${esc(cta)}</a></p>
<p style="color:#8a93ad;font-size:12px">If the button doesn't work, open this link: ${esc(url)}</p></div>`;
    try {
      await this.transport.sendMail({ from: env.MAIL_FROM, to, subject, text: `${heading}\n\n${body}\n\n${cta}: ${url}`, html });
      return true;
    } catch (e) {
      this.log.error(`mail to ${to} failed: ${(e as Error).message}`);
      return false;
    }
  }
}
