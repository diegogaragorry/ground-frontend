import React from "react";

export type TopbarProps = {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;
  isMobileFixed?: boolean;
  right?: React.ReactNode;
};

export function Topbar(props: TopbarProps) {
  const { title, subtitle, onOpenMenu, isMobileFixed, right } = props;
  return (
    <div className={isMobileFixed ? "topbar topbar-fixed-mobile" : "topbar"}>
      <div>
        <div className="h1" style={{ margin: 0 }}>
          {title}
        </div>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>

      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        {right}
        <button
          className="btn mobile-menu-btn"
          onClick={onOpenMenu}
          id="mobileMenuBtn"
          type="button"
          aria-label="Menu"
        >
          <span style={{ fontSize: 20 }}>☰</span>
        </button>
      </div>
    </div>
  );
}