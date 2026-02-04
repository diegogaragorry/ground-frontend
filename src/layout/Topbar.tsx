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
          className="btn"
          onClick={props.onOpenMenu}
          style={{ display: "none" }}
          id="mobileMenuBtn"
          type="button"
        >
          ☰
        </button>
      </div>
    </div>
  );
}