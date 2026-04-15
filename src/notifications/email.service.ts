import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail = 'NYAMA <onboarding@resend.dev>';

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('✅ Resend email service configured');
    } else {
      this.logger.warn('⚠️ RESEND_API_KEY not set — emails will be logged only');
    }
  }

  async sendApplicationReceived(
    email: string | null | undefined,
    firstName: string,
  ) {
    if (!email) return;
    const subject = 'Candidature NYAMA reçue ✅';
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F5F5F0; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #F57C20; font-size: 32px; margin: 0;">NYAMA</h1>
            <p style="color: #888; font-size: 14px;">Cuisine camerounaise livrée chez vous</p>
          </div>
          <h2 style="color: #1B4332; font-size: 22px;">Bonjour ${firstName} !</h2>
          <p style="color: #3D3D3D; font-size: 16px; line-height: 1.6;">
            Votre candidature a bien été reçue. Notre équipe l'examinera dans les prochaines <strong>48 heures</strong>.
          </p>
          <p style="color: #3D3D3D; font-size: 16px; line-height: 1.6;">
            Nous vous contacterons par email et WhatsApp dès que la décision sera prise.
          </p>
          <div style="background: #F5F5F0; border-radius: 12px; padding: 16px; margin-top: 24px;">
            <p style="color: #888; font-size: 13px; margin: 0;">
              💬 Une question ? Contactez-nous sur WhatsApp : <a href="https://wa.me/237699000000" style="color: #F57C20;">+237 699 000 000</a>
            </p>
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 24px; text-align: center;">
            © 2026 NYAMA Cameroon — Douala · Yaoundé · Bafoussam
          </p>
        </div>
      </div>
    `;
    await this.send(email, subject, html);
  }

  async sendPartnerApproved(
    email: string | null | undefined,
    firstName: string,
    accessCode: string,
    type: string,
  ) {
    if (!email) return;
    const appName =
      type === 'cuisiniere' ? 'Cuisine de Nyama' : 'Benskin Express';
    const subject = 'Candidature approuvée ! Bienvenue chez NYAMA 🎉';
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F5F5F0; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #F57C20; font-size: 32px; margin: 0;">NYAMA</h1>
          </div>
          <h2 style="color: #1B4332; font-size: 22px;">Félicitations ${firstName} ! 🎉</h2>
          <p style="color: #3D3D3D; font-size: 16px; line-height: 1.6;">
            Votre candidature a été <strong style="color: #22C55E;">approuvée</strong>. Bienvenue dans la famille NYAMA !
          </p>
          <div style="background: #1B4332; border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0 0 8px 0;">Votre code d'accès</p>
            <p style="color: #D4A017; font-size: 36px; font-weight: bold; font-family: 'Courier New', monospace; margin: 0; letter-spacing: 4px;">${accessCode}</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 12px; margin: 8px 0 0 0;">Ce code est à usage unique</p>
          </div>
          <h3 style="color: #3D3D3D; font-size: 18px;">Comment commencer :</h3>
          <ol style="color: #3D3D3D; font-size: 15px; line-height: 1.8;">
            <li>Téléchargez l'app <strong>${appName}</strong></li>
            <li>Ouvrez l'app et cliquez "Première connexion"</li>
            <li>Entrez votre numéro de téléphone</li>
            <li>Entrez le code <strong>${accessCode}</strong></li>
          </ol>
          <div style="background: #FFF8E1; border-radius: 12px; padding: 16px; margin-top: 16px;">
            <p style="color: #B8860B; font-size: 13px; margin: 0;">
              ⚠️ Ce code ne fonctionne qu'une seule fois. Après la première connexion, utilisez votre numéro de téléphone + code OTP.
            </p>
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 24px; text-align: center;">
            © 2026 NYAMA Cameroon
          </p>
        </div>
      </div>
    `;
    await this.send(email, subject, html);
  }

  async sendPartnerRejected(
    email: string | null | undefined,
    firstName: string,
    reason: string,
  ) {
    if (!email) return;
    const subject = 'Mise à jour de votre candidature NYAMA';
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F5F5F0; padding: 40px 20px;">
        <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #F57C20; font-size: 32px; margin: 0;">NYAMA</h1>
          </div>
          <h2 style="color: #3D3D3D; font-size: 22px;">Bonjour ${firstName},</h2>
          <p style="color: #3D3D3D; font-size: 16px; line-height: 1.6;">
            Après examen, nous ne sommes pas en mesure d'accepter votre candidature pour le moment.
          </p>
          <div style="background: #FEF2F2; border-radius: 12px; padding: 16px; margin: 16px 0;">
            <p style="color: #E8413C; font-size: 14px; margin: 0;"><strong>Motif :</strong> ${reason}</p>
          </div>
          <p style="color: #3D3D3D; font-size: 16px; line-height: 1.6;">
            Vous pouvez soumettre une nouvelle candidature dans 30 jours. N'hésitez pas à nous contacter pour plus d'informations.
          </p>
          <p style="color: #888; font-size: 12px; margin-top: 24px; text-align: center;">
            © 2026 NYAMA Cameroon
          </p>
        </div>
      </div>
    `;
    await this.send(email, subject, html);
  }

  private async send(to: string, subject: string, html: string) {
    if (!to) {
      this.logger.warn('No email address provided — skipping');
      return;
    }
    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        this.logger.log(
          `📧 Email envoyé à ${to}: ${subject} (id: ${result.data?.id ?? 'n/a'})`,
        );
      } catch (error) {
        const err = error as Error;
        this.logger.error(`❌ Erreur envoi email à ${to}: ${err.message}`);
      }
    } else {
      this.logger.log(`📧 [MOCK] Email → ${to}: ${subject}`);
    }
  }
}
