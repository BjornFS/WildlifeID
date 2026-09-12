import GROUPS from "./groups.js";

export default function Menu({ onStart, onStartEndless, onOpenDaily }) {
  return (
    <div className="card menu-card">
      <div className="menu-body">
        <div className="menu-brand">
          <span className="menu-icon">🐾</span>
          <h1 className="menu-title">WildlifeID</h1>
          <p className="menu-subtitle">Det Vilde Danmark</p>
        </div>

        <div className="menu-groups">
          {GROUPS.map((g) => (
            <button key={g.id} className="menu-option" onClick={() => onStart(g.id)}>
              <span className="menu-option-icon">{g.emoji}</span>
              <span className="menu-option-text">
                <span className="menu-option-name">{g.name_da}</span>
                <span className="menu-option-sub">{g.name_en}</span>
              </span>
            </button>
          ))}

          <button className="menu-option" onClick={onStartEndless}>
            <span className="menu-option-icon">♾️</span>
            <span className="menu-option-text">
              <span className="menu-option-name">Endless mode</span>
              <span className="menu-option-sub">Endeløs sjov</span>
            </span>
          </button>

          <button className="menu-option" onClick={onOpenDaily}>
            <span className="menu-option-icon">🗓️</span>
            <span className="menu-option-text">
              <span className="menu-option-name">Daglig udfordring</span>
              <span className="menu-option-sub">Nye spørgsmål hver dag</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
