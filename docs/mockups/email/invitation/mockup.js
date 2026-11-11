/* Preview-only behaviour: language and theme switches for the mockups.
   The real email has neither; its copy is chosen on the server. */

(function () {
  const DATA = {
    name: "María",
    inviter: "Eric",
    instance: "027Apps",
    url: "https://027apps.ericrf.com/invite/027_inv_9f3c1a7d6b2e",
    expiresAt: "2026-11-18T12:00:00Z",
  };

  const COPY = {
    es: {
      subject: "Eric te ha invitado a 027Apps",
      tag: "Invitación",
      greeting: "Hola, {name}",
      lead: "{inviter} te ha invitado a unirte a {instance}.",
      cta: "Aceptar invitación",
      fallback: "Si el botón no funciona, copia este enlace:",
      expiry: "Este enlace caduca el {date}",
      expiryDate: "{date}",
      expiryLabel: "Caducidad",
      invitedBy: "Invitado por",
      instanceLabel: "Instancia",
      linkLabel: "Enlace",
      security:
        "Si no esperabas esta invitación, ignora este mensaje. El enlace caduca solo y no da acceso a nadie más.",
      signatureRole: "Administrador de {instance}",
      footer: "Has recibido este correo porque alguien te ha invitado a {instance}.",
    },
    ca: {
      subject: "En Eric t'ha convidat a 027Apps",
      tag: "Invitació",
      greeting: "Hola, {name}",
      lead: "{inviter} t'ha convidat a unir-te a {instance}.",
      cta: "Accepta la invitació",
      fallback: "Si el botó no funciona, copia aquest enllaç:",
      expiry: "Aquest enllaç caduca el {date}",
      expiryDate: "{date}",
      expiryLabel: "Caducitat",
      invitedBy: "Convidat per",
      instanceLabel: "Instància",
      linkLabel: "Enllaç",
      security:
        "Si no esperaves aquesta invitació, ignora aquest missatge. L'enllaç caduca sol i no dona accés a ningú.",
      signatureRole: "Administrador de {instance}",
      footer: "Has rebut aquest correu perquè algú t'ha convidat a {instance}.",
    },
    gl: {
      subject: "Eric convidoute a 027Apps",
      tag: "Invitación",
      greeting: "Ola, {name}",
      lead: "{inviter} convidoute a unirte a {instance}.",
      cta: "Aceptar invitación",
      fallback: "Se o botón non funciona, copia esta ligazón:",
      expiry: "Esta ligazón caduca o {date}",
      expiryDate: "{date}",
      expiryLabel: "Caducidade",
      invitedBy: "Convidado por",
      instanceLabel: "Instancia",
      linkLabel: "Ligazón",
      security:
        "Se non esperabas esta invitación, ignora esta mensaxe. A ligazón caduca soa e non dá acceso a ninguén.",
      signatureRole: "Administrador de {instance}",
      footer: "Recibiches este correo porque alguén te convidou a {instance}.",
    },
    eu: {
      subject: "Ericek 027Apps-era gonbidatu zaitu",
      tag: "Gonbidapena",
      greeting: "Kaixo, {name}",
      lead: "{inviter}(e)k {instance}era batzeko gonbidapena egin dizu.",
      cta: "Onartu gonbidapena",
      fallback: "Botoiak funtzionatzen ez badu, kopiatu esteka hau:",
      expiry: "Esteka hau {date} iraungiko da",
      expiryDate: "{date}",
      expiryLabel: "Iraungitzea",
      invitedBy: "Nork gonbidatua",
      instanceLabel: "Instantzia",
      linkLabel: "Esteka",
      security:
        "Gonbidapen hau espero ez bazenuen, ez ikusi mezu honi. Esteka bere kabuz iraungiko da eta ez dio inori sarbiderik ematen.",
      signatureRole: "{instance}(e)ko administratzailea",
      footer: "Mezu hau jaso duzu norbaitek {instance}era gonbidatu zaituelako.",
    },
    pt: {
      subject: "O Eric convidou-te para 027Apps",
      tag: "Convite",
      greeting: "Olá, {name}",
      lead: "{inviter} convidou-te para te juntares a {instance}.",
      cta: "Aceitar convite",
      fallback: "Se o botão não funcionar, copia esta ligação:",
      expiry: "Esta ligação expira a {date}",
      expiryDate: "{date}",
      expiryLabel: "Expiração",
      invitedBy: "Convidado por",
      instanceLabel: "Instância",
      linkLabel: "Ligação",
      security:
        "Se não esperavas este convite, ignora esta mensagem. A ligação expira sozinha e não dá acesso a ninguém.",
      signatureRole: "Administrador de {instance}",
      footer: "Recebeste este email porque alguém te convidou para {instance}.",
    },
    fr: {
      subject: "Eric vous a invité à rejoindre 027Apps",
      tag: "Invitation",
      greeting: "Bonjour {name}",
      lead: "{inviter} vous a invité à rejoindre {instance}.",
      cta: "Accepter l'invitation",
      fallback: "Si le bouton ne fonctionne pas, copiez ce lien :",
      expiry: "Ce lien expire le {date}",
      expiryDate: "{date}",
      expiryLabel: "Expiration",
      invitedBy: "Invité par",
      instanceLabel: "Instance",
      linkLabel: "Lien",
      security:
        "Si vous n'attendiez pas cette invitation, ignorez ce message. Le lien expire de lui-même et ne donne accès à personne.",
      signatureRole: "Administrateur de {instance}",
      footer: "Vous recevez cet email car quelqu'un vous a invité à rejoindre {instance}.",
    },
    it: {
      subject: "Eric ti ha invitato a 027Apps",
      tag: "Invito",
      greeting: "Ciao {name}",
      lead: "{inviter} ti ha invitato a unirti a {instance}.",
      cta: "Accetta l'invito",
      fallback: "Se il pulsante non funziona, copia questo link:",
      expiry: "Questo link scade il {date}",
      expiryDate: "{date}",
      expiryLabel: "Scadenza",
      invitedBy: "Invitato da",
      instanceLabel: "Istanza",
      linkLabel: "Link",
      security:
        "Se non aspettavi questo invito, ignora questo messaggio. Il link scade da solo e non dà accesso a nessuno.",
      signatureRole: "Amministratore di {instance}",
      footer: "Hai ricevuto questa email perché qualcuno ti ha invitato a {instance}.",
    },
    de: {
      subject: "Eric hat dich zu 027Apps eingeladen",
      tag: "Einladung",
      greeting: "Hallo {name}",
      lead: "{inviter} hat dich eingeladen, {instance} beizutreten.",
      cta: "Einladung annehmen",
      fallback: "Wenn die Schaltfläche nicht funktioniert, kopiere diesen Link:",
      expiry: "Dieser Link läuft am {date} ab",
      expiryDate: "{date}",
      expiryLabel: "Ablauf",
      invitedBy: "Eingeladen von",
      instanceLabel: "Instanz",
      linkLabel: "Link",
      security:
        "Wenn du diese Einladung nicht erwartet hast, ignoriere diese Nachricht. Der Link läuft von selbst ab und verschafft niemandem Zugang.",
      signatureRole: "Administrator von {instance}",
      footer: "Du erhältst diese E-Mail, weil dich jemand zu {instance} eingeladen hat.",
    },
    en: {
      subject: "Eric invited you to 027Apps",
      tag: "Invitation",
      greeting: "Hi {name}",
      lead: "{inviter} has invited you to join {instance}.",
      cta: "Accept invitation",
      fallback: "If the button doesn't work, copy this link:",
      expiry: "This link expires on {date}",
      expiryDate: "{date}",
      expiryLabel: "Expires",
      invitedBy: "Invited by",
      instanceLabel: "Instance",
      linkLabel: "Link",
      security:
        "If you weren't expecting this invitation, ignore this message. The link expires on its own and gives no one access.",
      signatureRole: "Administrator of {instance}",
      footer: "You received this email because someone invited you to {instance}.",
    },
  };

  let locale = "es";

  function fill(text) {
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeZone: "UTC",
    }).format(new Date(DATA.expiresAt));
    return text
      .replace(/\{date\}/g, date)
      .replace(/\{(\w+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(DATA, key) ? DATA[key] : match,
      );
  }

  function render() {
    const copy = COPY[locale];
    document.documentElement.lang = locale;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      element.textContent = fill(copy[key] ?? "");
    });
    document.querySelectorAll("[data-link]").forEach((element) => {
      element.textContent = DATA.url;
      element.setAttribute("href", DATA.url);
    });
    document.querySelectorAll("[data-locale]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-locale") === locale),
      );
    });
  }

  function setTheme(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.querySelectorAll("[data-theme]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute("data-theme") === theme),
      );
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.locale) {
      locale = button.dataset.locale;
      render();
    }
    if (button.dataset.theme) setTheme(button.dataset.theme);
  });

  document.addEventListener("DOMContentLoaded", () => {
    render();
    setTheme(window.location.hash === "#dark" ? "dark" : "light");
  });
})();
