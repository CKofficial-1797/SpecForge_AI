import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ProjectDetailPage } from "../pages/ProjectDetailPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { RequirementDetailPage } from "../pages/RequirementDetailPage";

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
            to="/projects"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            Projects
          </NavLink>
        </nav>
        <div className="sidebar-footer">Engineering workspace</div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <span>Workspace</span>
          <span className="status">
            <i /> Ready
          </span>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="/requirements/:requirementId"
            element={<RequirementDetailPage />}
          />
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </main>
    </div>
  );
}
