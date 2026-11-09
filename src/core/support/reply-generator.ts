import type { IncidentCluster } from '../../types/incident.js';

export interface ReplyOptions {
  language?: 'en' | 'de' | 'es' | 'fr' | 'ja' | 'pt' | 'ro';
  supportUrl?: string;
  supportEmail?: string;
}

export class DeveloperReplyGenerator {
  public static generateReply(incident: IncidentCluster, options: ReplyOptions = {}): string {
    const lang = options.language || 'en';
    const supportContact = options.supportEmail
      ? `at ${options.supportEmail}`
      : options.supportUrl
      ? `via our support portal: ${options.supportUrl}`
      : 'through our in-app Help & Support page';

    const deviceContext =
      incident.deviceModels.length > 0 ? incident.deviceModels.slice(0, 2).join(' / ') : '';

    switch (lang) {
      case 'de':
        return (
          `Hallo! Vielen Dank für Ihr Feedback. Es tut uns leid, dass dieses Problem auf ${
            deviceContext ? `${deviceContext} ` : ''
          }nach dem Update auf Version ${incident.appVersion} aufgetreten ist. ` +
          `Unser Entwicklerteam untersucht die Ursache bereits intensiv und bereitet ein Update vor. ` +
          `Bitte kontaktieren Sie uns ${supportContact}, falls Sie weitere Details mitteilen möchten.`
        );

      case 'es':
        return (
          `¡Hola! Gracias por tus comentarios. Lamentamos mucho los inconvenientes experimentados en ${
            deviceContext ? `${deviceContext} ` : ''
          }con la versión ${incident.appVersion}. ` +
          `Nuestro equipo de ingeniería ya está trabajando en una solución urgente. ` +
          `Por favor, contáctanos ${supportContact} si necesitas asistencia inmediata.`
        );

      case 'fr':
        return (
          `Bonjour, merci pour votre retour. Nous sommes désolés pour ce dysfonctionnement constaté sur ${
            deviceContext ? `${deviceContext} ` : ''
          }avec la version ${incident.appVersion}. ` +
          `Nos équipes techniques analysent la situation afin de déployer un correctif rapidement. ` +
          `N'hésitez pas à nous contacter ${supportContact}.`
        );

      case 'ja':
        return (
          `いつもご利用いただき誠にありがとうございます。バージョン ${incident.appVersion}${
            deviceContext ? `（${deviceContext}）` : ''
          }にてご不便をおかけし大変申し訳ございません。` +
          `現在開発チームが原因究明と修正対応を急ぎ進めております。` +
          `お困りの際はサポート窓口（${supportContact}）までご連絡いただけますと幸いです。`
        );

      case 'pt':
        return (
          `Olá! Obrigado pelo seu feedback. Pedimos sinceras desculpas pelo problema ocorrido no ${
            deviceContext ? `${deviceContext} ` : ''
          }após a atualização para a versão ${incident.appVersion}. ` +
          `Nossa equipe de engenharia já está trabalhando em uma correção urgente. ` +
          `Por favor, fale conosco ${supportContact}.`
        );

      case 'ro':
        return (
          `Bună ziua! Vă mulțumim pentru feedback. Ne cerem scuze pentru neplăcerile întâmpinate pe ${
            deviceContext ? `${deviceContext} ` : ''
          }după actualizarea la versiunea ${incident.appVersion}. ` +
          `Echipa noastră de inginerie investighează cauza și pregătește un update corector. ` +
          `Vă rugăm să ne contactați ${supportContact} pentru asistență dedicată.`
        );

      case 'en':
      default:
        return (
          `Hi there, thank you for bringing this to our attention. We are very sorry for the issue you encountered on ${
            deviceContext ? `${deviceContext} ` : 'your device '
          }with release ${incident.appVersion}. ` +
          `Our engineering team has identified the failure and is actively preparing a hotfix. ` +
          `Please reach out to us ${supportContact} if you can share your account details so we can assist you directly.`
        );
    }
  }
}
