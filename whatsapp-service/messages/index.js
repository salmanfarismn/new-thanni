/**
 * i18n Message Resolver for WhatsApp bot.
 * 
 * Usage:
 *   const { getMessage } = require('./messages');
 *   const msg = getMessage('ta', 'welcome', 'Kumar');
 *   // Returns Tamil welcome message for Kumar
 */

const en = require('./en');
const ta = require('./ta');

const languages = { en, ta };

/**
 * Get a localized message by key and language.
 * Falls back to English if the key is not found in the target language.
 * 
 * @param {string} lang - Language code ('en' or 'ta')
 * @param {string} key - Message template key
 * @param {...any} args - Arguments to pass to the template function
 * @returns {string} Formatted message
 */
function getMessage(lang, key, ...args) {
    const langPack = languages[lang] || languages['en'];
    const template = langPack[key] || languages['en'][key];

    if (!template) {
        console.warn(`[i18n] Missing message key: ${key} for language: ${lang}`);
        return `[Missing message: ${key}]`;
    }

    try {
        return template(...args);
    } catch (err) {
        console.error(`[i18n] Error rendering ${key} in ${lang}:`, err.message);
        // Try English fallback
        try {
            return languages['en'][key](...args);
        } catch (fallbackErr) {
            return `[Error rendering message: ${key}]`;
        }
    }
}

/**
 * Check if a language code is supported.
 * @param {string} lang 
 * @returns {boolean}
 */
function isSupported(lang) {
    return lang in languages;
}

module.exports = { getMessage, isSupported, languages };
