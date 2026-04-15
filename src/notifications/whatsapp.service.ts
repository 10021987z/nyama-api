import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private normalize(phone: string): string {
    return (phone ?? '').replace(/[^0-9]/g, '');
  }

  buildLink(phone: string, message: string): string {
    const normalized = this.normalize(phone);
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  }

  generateReceivedWhatsAppUrl(phone: string, firstName: string): string {
    const message = `Bonjour ${firstName} ! ✅\n\nVotre candidature NYAMA a bien été reçue. Notre équipe l'examinera sous 48h.\n\nPour toute question : wa.me/237699000000\n\nL'équipe NYAMA 🇨🇲`;
    const url = this.buildLink(phone, message);
    this.logger.log(`📱 WhatsApp (received) URL generated for ${phone}`);
    return url;
  }

  generateApprovalWhatsAppUrl(
    phone: string,
    firstName: string,
    accessCode: string,
    type: string,
  ): string {
    const appName =
      type === 'cuisiniere' ? 'Cuisine de Nyama' : 'Benskin Express';
    const message = `🎉 Félicitations ${firstName} ! Votre candidature NYAMA est approuvée !\n\n🔑 Votre code d'accès : *${accessCode}*\n\n📱 Étapes :\n1. Téléchargez l'app "${appName}"\n2. Ouvrez l'app → "Première connexion"\n3. Entrez votre numéro + le code ci-dessus\n\n⚠️ Ce code est à usage unique.\n\nBienvenue dans la famille NYAMA ! 🇨🇲`;
    const url = this.buildLink(phone, message);
    this.logger.log(`📱 WhatsApp (approval) URL generated for ${phone}`);
    return url;
  }

  generateRejectionWhatsAppUrl(
    phone: string,
    firstName: string,
    reason: string,
  ): string {
    const message = `Bonjour ${firstName},\n\nAprès examen, nous ne sommes pas en mesure d'accepter votre candidature NYAMA pour le moment.\n\nMotif : ${reason}\n\nVous pouvez resoumettre dans 30 jours.\n\nL'équipe NYAMA`;
    const url = this.buildLink(phone, message);
    this.logger.log(`📱 WhatsApp (rejection) URL generated for ${phone}`);
    return url;
  }
}
