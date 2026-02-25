import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppShell } from "../layout/AppShell";
import { APP_BASE } from "../constants";
import "../styles/help.css";

const HELP_FAQ_ITEMS = [
  { q: "help.faq1Q", a: "help.faq1A" },
  { q: "help.faq2Q", a: "help.faq2A" },
  { q: "help.faq3Q", a: "help.faq3A" },
  { q: "help.faq4Q", a: "help.faq4A" },
  { q: "help.faq5Q", a: "help.faq5A" },
  { q: "help.faq6Q", a: "help.faq6A" },
];

export default function HelpPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { setHeader, setOnboardingTourStep } = useAppShell();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setHeader({ title: t("help.title"), subtitle: t("help.intro") });
  }, [setHeader, t]);

  function startTour() {
    setOnboardingTourStep(0);
    nav(`${APP_BASE}/expenses`, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="help-page">
      <div className="help-actions">
        <button type="button" className="btn primary" onClick={startTour}>
          {t("help.tourCta")}
        </button>
      </div>
      <section className="help-faq-section">
        <h2 className="help-faq-title">{t("help.faqTitle")}</h2>
        <div className="help-faq">
          {HELP_FAQ_ITEMS.map((item, i) => (
            <div key={i} className="help-faq-item">
              <button
                type="button"
                className="help-faq-toggle"
                aria-expanded={openFaq === i}
                aria-controls={`help-faq-answer-${i}`}
                id={`help-faq-question-${i}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{t(item.q)}</span>
                <span className="help-faq-icon" aria-hidden>▼</span>
              </button>
              <div
                id={`help-faq-answer-${i}`}
                role="region"
                aria-labelledby={`help-faq-question-${i}`}
                className="help-faq-content"
                style={{ display: openFaq === i ? "block" : "none" }}
              >
                {t(item.a)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
