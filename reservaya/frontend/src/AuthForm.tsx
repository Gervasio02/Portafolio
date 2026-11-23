import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Account } from "./api";

export function AuthForm({ done }: { done: () => void }) {
  const [signUp, setSignUp] = useState(false);
  const cache = useQueryClient();
  const session = useMutation({
    mutationFn: (fields: object) =>
      api<Account>(signUp ? "/auth/register" : "/auth/login", "POST", fields),
    onSuccess: (user) => {
      cache.setQueryData(["account"], user);
      done();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    session.mutate(Object.fromEntries(new FormData(event.currentTarget)));
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <h2>{signUp ? "Crea tu cuenta" : "Inicia sesión"}</h2>
      {signUp && (
        <label>
          Nombre
          <input
            name="name"
            minLength={2}
            maxLength={80}
            autoComplete="name"
            required
          />
        </label>
      )}
      <label>
        Correo electrónico
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input
          name="password"
          type="password"
          minLength={signUp ? 10 : 1}
          maxLength={128}
          autoComplete={signUp ? "new-password" : "current-password"}
          required
        />
      </label>
      {session.error && (
        <p className="error" role="alert">
          {session.error.message}
        </p>
      )}
      <button className="btn-primary" disabled={session.isPending}>
        {session.isPending ? "Un momento…" : signUp ? "Crear cuenta" : "Entrar"}
      </button>
      <button
        type="button"
        className="btn-text"
        onClick={() => {
          setSignUp(!signUp);
          session.reset();
        }}
      >
        {signUp ? "Ya tengo una cuenta" : "Crear una cuenta"}
      </button>
    </form>
  );
}
