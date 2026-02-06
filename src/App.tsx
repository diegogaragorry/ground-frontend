import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppShell, AppShellProvider } from "./layout/AppShell";

import ExpensesPage from "./pages/ExpensesPage";
import IncomePage from "./pages/IncomePage";
import DashboardPage from "./pages/DashboardPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import BudgetsPage from "./pages/BudgetsPage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
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
    <BrowserRouter>
      <Routes>
        {/* PUBLIC */}
        <Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
        {/* PROTECTED APP */}
        <Route
          path="/"
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
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}