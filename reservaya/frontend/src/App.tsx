import {
  CalendarDays,
  LogOut,
  MoveUpRight,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { account, api } from "./api";
import { AdminPage } from "./AdminPage";
import { AuthForm } from "./AuthForm";
import { BookingPage } from "./BookingPage";
import { HomePage } from "./HomePage";
import { ReservationsPage } from "./ReservationsPage";

function Header() {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const session = useQuery({ queryKey: ["account"], queryFn: account });
  const logout = useMutation({
    mutationFn: () => api<void>("/auth/logout", "POST"),
    onSuccess: () => {
      cache.setQueryData(["account"], null);
      cache.removeQueries({ queryKey: ["bookings"] });
      cache.removeQueries({ queryKey: ["admin-bookings"] });
      void navigate("/");
    },
  });
  return (
    <header className="topbar">
      <div className="container header-inner">
        <Link className="brand" to="/">
          <span>
            <Trophy size={18} />
          </span>{" "}
          Reserva<b>Ya</b>
        </Link>
        <nav aria-label="Navegación principal">
          <NavLink end to="/">
            Canchas
          </NavLink>
          <NavLink to="/reservas">
            <CalendarDays size={16} /> <span>Mis reservas</span>
          </NavLink>
          {session.data?.role === "admin" && (
            <NavLink to="/admin">Administración</NavLink>
          )}
          {session.data ? (
            <button
              className="chip"
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          ) : (
            <Link className="chip" to="/ingresar">
              <UserCircle size={17} />
              <span>Ingresar</span>
            </Link>
          )}
        </nav>
      </div>
      {logout.error && (
        <p className="container error" role="alert">
          {logout.error.message}
        </p>
      )}
    </header>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const next = query.get("next") === "/reservas" ? "/reservas" : "/";
  return (
    <main className="container section">
      <div className="panel login-panel">
        <AuthForm done={() => void navigate(next)} />
      </div>
    </main>
  );
}

export function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cancha/:id" element={<BookingPage />} />
        <Route path="/reservas" element={<ReservationsPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <main className="container section">
              <h1>Página no encontrada</h1>
              <Link to="/">Volver al inicio</Link>
            </main>
          }
        />
      </Routes>
      <footer className="footer">
        <div className="container">
          <span>ReservaYa · Rancagua, Chile</span>
          <a href="/api/docs">
            API <MoveUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
