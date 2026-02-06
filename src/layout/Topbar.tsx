import React from "react";

export function Topbar(props: {
  title: string;
  subtitle?: string;
  onOpenMenu?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div>
        <div className="h1" style={{ margin: 0 }}>
          {props.title}
        </div>
        {props.subtitle && <div className="muted">{props.subtitle}</div>}
      </div>

      <div className="row" style={{ gap: 12, alignItems: "center" }}>
        {props.right}
        <button
          className="btn mobile-menu-btn"
          onClick={props.onOpenMenu}
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