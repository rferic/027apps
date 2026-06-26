import en from './locales/en.json'
import es from './locales/es.json'
import it from './locales/it.json'
import ca from './locales/ca.json'
import fr from './locales/fr.json'
import de from './locales/de.json'

export const locales = { en, es, it, ca, fr, de }
export type Locale = keyof typeof locales
