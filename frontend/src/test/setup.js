import '@testing-library/jest-dom/vitest'
import { setLanguage } from '../i18n'

// Component tests assert the English copy; Hebrew is covered by src/i18n/i18n.test.js.
setLanguage('en')
