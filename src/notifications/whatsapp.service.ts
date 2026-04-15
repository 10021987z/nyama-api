import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private normalize(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  buildLink(phone: string, message: string): string {
    const normalized = this.normalize(phone);
    return `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(message)}`;
  }

  sendNotification(phone: string, message: string): string {
    const link = this.buildLink(phone, message);
    this.logger.log(`📱 WHATSAPP → ${phone}: ${message}`);
    this.logger.log(`   Link: ${link}`);
    return link;
  }

  sendApplicationReceived(phone: string, firstName: string, applicationId: string) {
    const shortId = applicationId.slice(0, 8).toUpperCase();
    const msg = `Bonjour ${firstName} ! Votre candidature NYAMA a été reçue. Nous la traiterons sous 48h. Référence : ${shortId}. Pour toute question : wa.me/237699000000`;
    return this.sendNotification(phone, msg);
  }

  sendApproval(phone: string, firstName: string, accessCode: string, type: 'cuisiniere' | 'livreur' | string) {
    const app = type === 'livreur' ? 'Benskin Express' : 'Cuisine de Nyama';
    const msg = `Félicitations ${firstName} ! Votre candidature NYAMA est approuvée ! Votre code d'accès : ${accessCode}. Téléchargez l'app ${app} et connectez-vous avec votre numéro + ce code. Bienvenue dans la famille NYAMA !`;
    return this.sendNotification(phone, msg);
  }

  sendRejection(phone: string, firstName: string, reason: string) {
    const msg = `Bonjour ${firstName}, nous sommes désolés mais votre candidature NYAMA n'a pas été retenue. Raison : ${reason}. Vous pouvez resoumettre une candidature dans 30 jours.`;
    return this.sendNotification(phone, msg);
  }
}
