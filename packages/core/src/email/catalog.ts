import type { EmailCopy, EmailLocale } from "./types";

/**
 * Copy of the invitation email in every supported locale.
 *
 * The English keys are the contract; `catalog.test.ts` fails when a locale
 * misses a key or changes a placeholder. The date is always `{date}` and is
 * formatted by the template, never written here.
 */
export const EMAIL_COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    subject: "{inviter} invited you to {instance}",
    preheader: "{inviter} invited you to join {instance}.",
    greeting: "Hi {name}",
    lead: "{inviter} has invited you to join {instance}.",
    cta: "Accept invitation",
    fallback: "If the button doesn't work, copy this link:",
    expiry: "This link expires on {date}",
    security:
      "If you weren't expecting this invitation, ignore this message. The link expires on its own and gives no one access.",
    footer: "You received this email because someone invited you to {instance}.",
  },
  es: {
    subject: "{inviter} te ha invitado a {instance}",
    preheader: "{inviter} te ha invitado a unirte a {instance}.",
    greeting: "Hola, {name}",
    lead: "{inviter} te ha invitado a unirte a {instance}.",
    cta: "Aceptar invitación",
    fallback: "Si el botón no funciona, copia este enlace:",
    expiry: "Este enlace caduca el {date}",
    security:
      "Si no esperabas esta invitación, ignora este mensaje. El enlace caduca solo y no da acceso a nadie más.",
    footer: "Has recibido este correo porque alguien te ha invitado a {instance}.",
  },
  ca: {
    subject: "{inviter} t'ha convidat a {instance}",
    preheader: "{inviter} t'ha convidat a unir-te a {instance}.",
    greeting: "Hola, {name}",
    lead: "{inviter} t'ha convidat a unir-te a {instance}.",
    cta: "Accepta la invitació",
    fallback: "Si el botó no funciona, copia aquest enllaç:",
    expiry: "Aquest enllaç caduca el {date}",
    security:
      "Si no esperaves aquesta invitació, ignora aquest missatge. L'enllaç caduca sol i no dona accés a ningú.",
    footer: "Has rebut aquest correu perquè algú t'ha convidat a {instance}.",
  },
  gl: {
    subject: "{inviter} convidoute a {instance}",
    preheader: "{inviter} convidoute a unirte a {instance}.",
    greeting: "Ola, {name}",
    lead: "{inviter} convidoute a unirte a {instance}.",
    cta: "Aceptar invitación",
    fallback: "Se o botón non funciona, copia esta ligazón:",
    expiry: "Esta ligazón caduca o {date}",
    security:
      "Se non esperabas esta invitación, ignora esta mensaxe. A ligazón caduca soa e non dá acceso a ninguén.",
    footer: "Recibiches este correo porque alguén te convidou a {instance}.",
  },
  eu: {
    subject: "{inviter}(e)k {instance}era gonbidatu zaitu",
    preheader: "{inviter}(e)k {instance}era batzeko gonbidapena egin dizu.",
    greeting: "Kaixo, {name}",
    lead: "{inviter}(e)k {instance}era batzeko gonbidapena egin dizu.",
    cta: "Onartu gonbidapena",
    fallback: "Botoiak funtzionatzen ez badu, kopiatu esteka hau:",
    expiry: "Esteka hau {date} iraungiko da",
    security:
      "Gonbidapen hau espero ez bazenuen, ez ikusi mezu honi. Esteka bere kabuz iraungiko da eta ez dio inori sarbiderik ematen.",
    footer: "Mezu hau jaso duzu norbaitek {instance}era gonbidatu zaituelako.",
  },
  pt: {
    subject: "{inviter} convidou-te para {instance}",
    preheader: "{inviter} convidou-te para te juntares a {instance}.",
    greeting: "Olá, {name}",
    lead: "{inviter} convidou-te para te juntares a {instance}.",
    cta: "Aceitar convite",
    fallback: "Se o botão não funcionar, copia esta ligação:",
    expiry: "Esta ligação expira a {date}",
    security:
      "Se não esperavas este convite, ignora esta mensagem. A ligação expira sozinha e não dá acesso a ninguém.",
    footer: "Recebeste este email porque alguém te convidou para {instance}.",
  },
  fr: {
    subject: "{inviter} vous a invité à rejoindre {instance}",
    preheader: "{inviter} vous a invité à rejoindre {instance}.",
    greeting: "Bonjour {name}",
    lead: "{inviter} vous a invité à rejoindre {instance}.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, copiez ce lien :",
    expiry: "Ce lien expire le {date}",
    security:
      "Si vous n'attendiez pas cette invitation, ignorez ce message. Le lien expire de lui-même et ne donne accès à personne.",
    footer: "Vous recevez cet email car quelqu'un vous a invité à rejoindre {instance}.",
  },
  it: {
    subject: "{inviter} ti ha invitato a {instance}",
    preheader: "{inviter} ti ha invitato a unirti a {instance}.",
    greeting: "Ciao {name}",
    lead: "{inviter} ti ha invitato a unirti a {instance}.",
    cta: "Accetta l'invito",
    fallback: "Se il pulsante non funziona, copia questo link:",
    expiry: "Questo link scade il {date}",
    security:
      "Se non aspettavi questo invito, ignora questo messaggio. Il link scade da solo e non dà accesso a nessuno.",
    footer: "Hai ricevuto questa email perché qualcuno ti ha invitato a {instance}.",
  },
  de: {
    subject: "{inviter} hat dich zu {instance} eingeladen",
    preheader: "{inviter} hat dich eingeladen, {instance} beizutreten.",
    greeting: "Hallo {name}",
    lead: "{inviter} hat dich eingeladen, {instance} beizutreten.",
    cta: "Einladung annehmen",
    fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link:",
    expiry: "Dieser Link läuft am {date} ab",
    security:
      "Wenn du diese Einladung nicht erwartet hast, ignoriere diese Nachricht. Der Link läuft von selbst ab und verschafft niemandem Zugang.",
    footer: "Du erhältst diese E-Mail, weil dich jemand zu {instance} eingeladen hat.",
  },
};
