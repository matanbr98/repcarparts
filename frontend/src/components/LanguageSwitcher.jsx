import { LANGUAGES, useLanguage } from "../i18n";
import Icon from "./ui/Icon";

/**
 * Language picker.
 *   variant="segmented" - both languages side by side (profile settings)
 *   variant="button"    - one compact button that switches to the other language (auth pages)
 * Each language name is written in that language and marked with lang="..." for screen readers.
 */
export default function LanguageSwitcher({ variant = "segmented", className = "" }) {
  const { lang, setLanguage, t } = useLanguage();

  if (variant === "button") {
    const other = LANGUAGES.find((l) => l.code !== lang) || LANGUAGES[0];
    return (
      <button
        type="button"
        className={`btn btn--ghost btn--sm lang-button ${className}`.trim()}
        onClick={() => setLanguage(other.code)}
        aria-label={t("Change language to {language}", { language: other.label })}
      >
        <Icon name="globe" size={15} />
        <span lang={other.code}>{other.label}</span>
      </button>
    );
  }

  return (
    <div className={`segmented ${className}`.trim()} role="group" aria-label={t("Language")}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          className="segmented__item"
          aria-pressed={lang === l.code}
          onClick={() => setLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
