import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage";

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="SpecForge home">
          <span className="brand-mark">S</span>
          <span>SpecForge</span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Overview
          </NavLink>
        </nav>
        <div className="sidebar-footer">Engineering workspace</div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>Workspace</span>
          <span className="status">
            <i /> Foundation
          </span>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  );
}
