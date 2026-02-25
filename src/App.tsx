import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppShell, AppShellProvider } from "./layout/AppShell";
import { EncryptionProvider } from "./context/EncryptionContext";
import { APP_BASE } from "./constants";

import LandingPage from "./pages/LandingPage";
import ExpensesPage from "./pages/ExpensesPage";
import IncomePage from "./pages/IncomePage";
import DashboardPage from "./pages/DashboardPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import BudgetsPage from "./pages/BudgetsPage";
import AdminPage from "./pages/AdminPage";
import HelpPage from "./pages/HelpPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import AccountPage from "./pages/AccountPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ShellLayout() {
  return (
    <AppShellProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AppShellProvider>
  );
}

export default function App() {
  return (
    <EncryptionProvider>
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        {/* PROTECTED APP */}
        <Route
          path={APP_BASE}
          element={
            <RequireAuth>
              <ShellLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="income" element={<IncomePage />} />
          <Route path="investments" element={<InvestmentsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </EncryptionProvider>
  );
}