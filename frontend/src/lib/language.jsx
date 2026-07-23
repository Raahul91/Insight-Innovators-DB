import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const LANGS = [
  { code: "en", label: "English", short: "EN", locale: "en-US" },
  { code: "de", label: "Deutsch", short: "DE", locale: "de-DE" },
  { code: "fr", label: "Français", short: "FR", locale: "fr-FR" },
  { code: "es", label: "Español", short: "ES", locale: "es-ES" },
  { code: "it", label: "Italiano", short: "IT", locale: "it-IT" },
];

export const STRINGS = {
  en: {
    era_intro:
      "Hi, I'm ERA — your European Relationship Assistant. I can walk you through the questionnaire, explain any question in plain language, and suggest which answer fits your situation best. Tap the mic and just talk to me, or type below.",
    greet_objectives:
      "Welcome! I'm ERA. Let's figure out your investment profile together. I'll stay here on the right — just tap ‘Ask ERA to explain’ on any question if you need help.",
    greet_dashboard:
      "Welcome back to your portfolio. I'm ERA — ask me anything about your holdings or performance, in any European language.",
    greet_products:
      "This is your investment catalogue. Ask me about any UCITS ETF, stock or bond and I'll explain it in plain terms.",
    era_status_helping: "ERA is helping…",
    era_status_summary: "ERA is preparing your recommendation…",
    ask_era_explain: "Ask ERA to explain",
    help_me_answer: "Help me answer this",
    era_input_placeholder: "Ask ERA about your portfolio…",
    era_role: "European Relationship Assistant",
    era_intro_greeting_prompt:
      "Give the user a warm, one-sentence spoken welcome to the Financial Objectives questionnaire and remind them that I can explain any question if they need.",
    era_result_summary_prompt:
      "Give the user a warm, 2-3 sentence spoken summary of their assessment result. Mention the horizon, risk profile and one key portfolio takeaway. Do not repeat the numbers verbatim.",
    section_dashboard: "Here's your portfolio",
    section_objectives: "Let's set your goals",
    section_products: "Explore investments",
  },
  de: {
    era_intro:
      "Hallo, ich bin ERA — dein European Relationship Assistant. Ich führe dich durch den Fragebogen, erkläre jede Frage in einfacher Sprache und schlage dir die passende Antwort für deine Situation vor. Tipp auf das Mikrofon und sprich mit mir oder schreib unten.",
    greet_objectives:
      "Willkommen! Ich bin ERA. Wir ermitteln gemeinsam dein Anlegerprofil. Ich bleibe hier rechts — tipp bei jeder Frage einfach auf ‚ERA um Erklärung bitten‘, wenn du Hilfe brauchst.",
    greet_dashboard:
      "Willkommen zurück in deinem Portfolio. Ich bin ERA — frag mich in jeder europäischen Sprache alles zu deinen Positionen oder deiner Performance.",
    greet_products:
      "Das ist dein Anlagekatalog. Frag mich zu jedem UCITS-ETF, Aktien oder Anleihen — ich erkläre es dir verständlich.",
    era_status_helping: "ERA hilft dir…",
    era_status_summary: "ERA bereitet deine Empfehlung vor…",
    ask_era_explain: "ERA um Erklärung bitten",
    help_me_answer: "Hilf mir bei der Antwort",
    era_input_placeholder: "Frag ERA zu deinem Portfolio…",
    era_role: "European Relationship Assistant",
    era_intro_greeting_prompt:
      "Begrüße den Nutzer in einem warmen, kurzen Satz zum Fragebogen 'Finanzielle Ziele' und erinnere daran, dass du jede Frage erklären kannst.",
    era_result_summary_prompt:
      "Gib dem Nutzer eine warme, 2-3 Sätze lange gesprochene Zusammenfassung seines Ergebnisses (Anlagehorizont, Risikoprofil, ein wichtiger Portfolio-Tipp). Wiederhole keine Zahlen wortwörtlich.",
    section_dashboard: "Hier ist dein Portfolio",
    section_objectives: "Definieren wir deine Ziele",
    section_products: "Entdecke Investments",
  },
  fr: {
    era_intro:
      "Bonjour, je suis ERA — votre European Relationship Assistant. Je vous accompagne dans le questionnaire, j'explique chaque question simplement et je vous suggère la réponse la plus adaptée. Appuyez sur le micro pour me parler ou tapez ci-dessous.",
    greet_objectives:
      "Bienvenue ! Je suis ERA. Nous allons définir votre profil d'investisseur ensemble. Je reste ici à droite — appuyez sur ‘Demander à ERA d'expliquer’ sur n'importe quelle question si vous avez besoin d'aide.",
    greet_dashboard:
      "Bon retour dans votre portefeuille. Je suis ERA — posez-moi vos questions sur vos positions ou vos performances, dans n'importe quelle langue européenne.",
    greet_products:
      "Voici votre catalogue d'investissements. Demandez-moi n'importe quel ETF UCITS, action ou obligation — je vous l'explique clairement.",
    era_status_helping: "ERA vous aide…",
    era_status_summary: "ERA prépare votre recommandation…",
    ask_era_explain: "Demander à ERA d'expliquer",
    help_me_answer: "Aidez-moi à répondre",
    era_input_placeholder: "Posez une question à ERA…",
    era_role: "European Relationship Assistant",
    era_intro_greeting_prompt:
      "Souhaitez la bienvenue à l'utilisateur en une phrase chaleureuse pour le questionnaire 'Objectifs financiers' et rappelez que vous pouvez expliquer chaque question.",
    era_result_summary_prompt:
      "Donnez à l'utilisateur un résumé oral chaleureux de 2-3 phrases de son résultat (horizon, profil de risque, un conseil clé). Ne répétez pas les chiffres mot pour mot.",
    section_dashboard: "Voici votre portefeuille",
    section_objectives: "Définissons vos objectifs",
    section_products: "Explorez les investissements",
  },
  es: {
    era_intro:
      "Hola, soy ERA — tu European Relationship Assistant. Te acompaño en el cuestionario, te explico cada pregunta en lenguaje sencillo y te sugiero la respuesta que mejor se adapta a ti. Toca el micrófono para hablarme o escribe abajo.",
    greet_objectives:
      "¡Bienvenido! Soy ERA. Vamos a definir juntos tu perfil de inversor. Me quedo aquí a la derecha — pulsa ‘Pídele a ERA que lo explique’ en cualquier pregunta si necesitas ayuda.",
    greet_dashboard:
      "Bienvenido de nuevo a tu cartera. Soy ERA — pregúntame lo que quieras sobre tus posiciones o rentabilidad, en cualquier idioma europeo.",
    greet_products:
      "Este es tu catálogo de inversiones. Pregúntame por cualquier ETF UCITS, acción o bono y te lo explico con claridad.",
    era_status_helping: "ERA te está ayudando…",
    era_status_summary: "ERA está preparando tu recomendación…",
    ask_era_explain: "Pídele a ERA que lo explique",
    help_me_answer: "Ayúdame a responder",
    era_input_placeholder: "Pregúntale a ERA sobre tu cartera…",
    era_role: "European Relationship Assistant",
    era_intro_greeting_prompt:
      "Da la bienvenida al usuario en una frase cálida al cuestionario de 'Objetivos financieros' y recuérdale que puedes explicar cualquier pregunta.",
    era_result_summary_prompt:
      "Ofrece al usuario un resumen oral cálido de 2-3 frases de su resultado (horizonte, perfil de riesgo y una recomendación clave). No repitas los números literalmente.",
    section_dashboard: "Aquí está tu cartera",
    section_objectives: "Definamos tus objetivos",
    section_products: "Explora las inversiones",
  },
  it: {
    era_intro:
      "Ciao, sono ERA — il tuo European Relationship Assistant. Ti guido nel questionario, ti spiego ogni domanda in modo semplice e ti suggerisco la risposta più adatta alla tua situazione. Tocca il microfono e parlami, oppure scrivi qui sotto.",
    greet_objectives:
      "Benvenuto! Sono ERA. Definiamo insieme il tuo profilo d'investitore. Resto qui a destra — tocca ‘Chiedi a ERA di spiegare’ in qualsiasi domanda se hai bisogno.",
    greet_dashboard:
      "Bentornato nel tuo portafoglio. Sono ERA — chiedimi tutto sui tuoi titoli o sulla performance, in qualsiasi lingua europea.",
    greet_products:
      "Questo è il tuo catalogo d'investimento. Chiedimi di qualsiasi ETF UCITS, azione o obbligazione — te lo spiego con parole semplici.",
    era_status_helping: "ERA ti sta aiutando…",
    era_status_summary: "ERA sta preparando la tua raccomandazione…",
    ask_era_explain: "Chiedi a ERA di spiegare",
    help_me_answer: "Aiutami a rispondere",
    era_input_placeholder: "Chiedi a ERA del tuo portafoglio…",
    era_role: "European Relationship Assistant",
    era_intro_greeting_prompt:
      "Dai un benvenuto caloroso in una frase all'utente per il questionario 'Obiettivi finanziari' e ricordagli che puoi spiegare qualsiasi domanda.",
    era_result_summary_prompt:
      "Dai all'utente un riepilogo orale caloroso di 2-3 frasi del risultato (orizzonte, profilo di rischio, un consiglio chiave). Non ripetere i numeri letteralmente.",
  },
};

const LanguageCtx = createContext({
  code: "en",
  label: "English",
  short: "EN",
  locale: "en-US",
  setCode: () => {},
  t: (key) => STRINGS.en[key] || key,
});

export const LanguageProvider = ({ children }) => {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem("era-lang") || "en";
    } catch (_) {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("era-lang", code);
    } catch (_) {}
  }, [code]);

  const value = useMemo(() => {
    const lang = LANGS.find((l) => l.code === code) || LANGS[0];
    return {
      ...lang,
      setCode,
      t: (key) => (STRINGS[code] && STRINGS[code][key]) || STRINGS.en[key] || key,
    };
  }, [code]);

  return <LanguageCtx.Provider value={value}>{children}</LanguageCtx.Provider>;
};

export const useLanguage = () => useContext(LanguageCtx);
