// Tooltip tour after wizard: Expenses → Investments → Budget → Dashboard
import { useTranslation } from "react-i18next";

const TOUR_STEPS = 4;
const SIDEBAR_WIDTH_DESKTOP = 220;

export function OnboardingTour(props: {
  step: number;
  onNext: () => void;
  onClose: () => void;
  /** En desktop true = no cubrir el sidebar para que se vea la iluminación del ítem activo */
  leaveSidebarVisible?: boolean;
}) {
  const { t } = useTranslation();
  const { step, onNext, onClose, leaveSidebarVisible } = props;
  const isLast = step === TOUR_STEPS - 1;

  return (
    <div
      className="onboarding-tour-overlay"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: leaveSidebarVisible ? SIDEBAR_WIDTH_DESKTOP : 0,
        zIndex: 9998,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="card"
        style={{
          padding: 24,
          maxWidth: 480,
          maxHeight: "85vh",
          overflow: "auto",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
          {t(`onboarding.tourStep${step}Title`)}
        </div>
        <div className="muted" style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
          {t(`onboarding.tourStep${step}Body`)}
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={onClose}>
            {t("onboarding.tourSkip")}
          </button>
          <button type="button" className="btn primary" onClick={onNext}>
            {isLast ? t("onboarding.tourFinish") : t("onboarding.tourNext")}
          </button>
        </div>
      </div>
    </div>
  );
}
