export function createApi() {
  let token;
  let refreshing;

  async function request(
    path,
    { method = "GET", body, protectedRoute = true, retry = true, signal } = {},
  ) {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(protectedRoute && token
          ? { Authorization: `Bearer ${token}` }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && protectedRoute && retry) {
      await refresh();
      return request(path, { method, body, retry: false, signal });
    }
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(
        data.error || "No se pudo completar la solicitud.",
      );
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function signIn(mode, values) {
    const result = await request(`/auth/${mode}`, {
      method: "POST",
      body: values,
      protectedRoute: false,
    });
    token = result.accessToken;
    return result.user;
  }

  function refresh() {
    refreshing ??= signIn("refresh").finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }

  async function logout() {
    await request("/auth/logout", { method: "POST", protectedRoute: false });
    token = undefined;
  }

  return { request, refresh, signIn, logout };
}
