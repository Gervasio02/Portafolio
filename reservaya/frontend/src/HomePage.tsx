import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type Service, type Sport } from "./api";
import { SPORTS, price } from "./format";

export function HomePage() {
  const [filter, setFilter] = useState<Sport | "all">("all");
  const services = useQuery({
    queryKey: ["services"],
    queryFn: () => api<Service[]>("/services"),
  });
  const visible =
    services.data?.filter(
      (service) => filter === "all" || service.sport === filter,
    ) ?? [];

  return (
    <main>
      <section className="hero container">
        <div className="hero-content">
          <p className="eyebrow">
            <span className="indicator" /> Reservas deportivas en Rancagua
          </p>
          <h1>
            Tu próximo
            <br />
            partido <em>parte aquí.</em>
          </h1>
          <p>
            Compara las horas libres de cada cancha y asegura tu turno. Los
            cambios de horario y bloqueos de mantención se reflejan al reservar.
          </p>
          <a href="#canchas" className="btn-primary">
            Explorar canchas <ArrowRight size={18} />
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="field">
            <i />
            <b />
            <span className="field-area left" />
            <span className="field-area right" />
          </div>
          <div className="field-ball" />
        </div>
      </section>
      <section id="canchas" className="container listing">
        <div className="listing-header">
          <div>
            <p className="eyebrow">Encuentra tu espacio</p>
            <h2>Canchas disponibles</h2>
          </div>
          <div className="sport-filters" aria-label="Filtrar por deporte">
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              Todas
            </button>
            {Object.entries(SPORTS).map(([sport, label]) => (
              <button
                key={sport}
                type="button"
                aria-pressed={filter === sport}
                onClick={() => setFilter(sport as Sport)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {services.isPending && <p>Cargando canchas…</p>}
        {services.error && (
          <p className="error" role="alert">
            {services.error.message}
          </p>
        )}
        {services.isSuccess && !visible.length && (
          <p>No hay canchas para este filtro.</p>
        )}
        <div className="service-grid">
          {visible.map((service) => (
            <article className="service-card" key={service.id}>
              <div className={`card-art ${service.sport}`}>
                <span className="sport-tag">{SPORTS[service.sport]}</span>
                <div className="mini-field" aria-hidden="true">
                  <i />
                  <b />
                </div>
              </div>
              <div className="card-body">
                <h3>{service.name}</h3>
                <p className="muted">
                  <MapPin size={15} /> {service.court}
                </p>
                <p className="description">{service.description}</p>
                <div className="service-details">
                  <strong>{price(service.price)}</strong>
                  <span>
                    <Clock3 size={14} /> 1 hora
                  </span>
                </div>
                <Link className="card-action" to={`/cancha/${service.id}`}>
                  Ver horarios <ArrowRight size={18} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
