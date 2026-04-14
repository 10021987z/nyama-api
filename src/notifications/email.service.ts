import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private log(email: string, subject: string, body: string) {
    console.log(`📧 EMAIL → ${email}: ${subject}\n${body}`);
  }

  sendApplicationReceivedEmail(email: string | null | undefined, name: string) {
    if (!email) return;
    const subject = 'Candidature NYAMA reçue';
    const body = `Bonjour ${name},\n\nNous avons bien reçu votre candidature pour rejoindre NYAMA. Notre équipe va l'examiner sous 48 à 72 heures.\n\nVous recevrez un email dès qu'une décision sera prise.\n\nL'équipe NYAMA`;
    this.log(email, subject, body);
  }

  sendPartnerApprovalEmail(
    email: string | null | undefined,
    name: string,
    accessCode: string,
    type: 'cuisiniere' | 'livreur' | string,
  ) {
    if (!email) return;
    const role = type === 'livreur' ? 'livreur' : 'cuisinière';
    const app = type === 'livreur' ? 'NYAMA Rider' : 'NYAMA Pro';
    const subject = `🎉 Candidature NYAMA approuvée — Votre code d'accès`;
    const body = `Bonjour ${name},\n\nFélicitations ! Votre candidature pour devenir ${role} NYAMA a été approuvée.\n\nVotre code d'accès personnel :\n\n    ${accessCode}\n\nPour activer votre compte :\n1. Téléchargez l'application ${app}\n2. Sur l'écran de connexion, choisissez "Première connexion"\n3. Entrez votre numéro (${'\u00A0'}celui de la candidature${'\u00A0'}) et ce code\n\n⚠️ Ce code est à usage unique. Conservez-le précieusement.\n\nBienvenue dans la famille NYAMA !`;
    this.log(email, subject, body);
  }

  sendPartnerRejectionEmail(
    email: string | null | undefined,
    name: string,
    reason: string,
  ) {
    if (!email) return;
    const subject = 'Candidature NYAMA — Décision';
    const body = `Bonjour ${name},\n\nAprès étude, nous ne pouvons donner suite à votre candidature pour le moment.\n\nMotif : ${reason}\n\nVous pouvez soumettre une nouvelle candidature ultérieurement.\n\nL'équipe NYAMA`;
    this.log(email, subject, body);
  }
}
