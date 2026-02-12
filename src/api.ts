const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const isProduction = () => {
  try {
    const url = API_BASE ?? "";
    return !url.includes("localhost") && !url.startsWith("http://127.");
  } catch {
    return false;
  }
};

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const m = String((err as Error).message).toLowerCase();
    return m.includes("fetch") || m.includes("network") || m.includes("failed to fetch") || m.includes("load failed");
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return m.includes("network") || m.includes("failed to fetch") || m.includes("load failed");
  }
  return false;
}

function isJsonResponse(res: Response) {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");

  const hasBody = options.body !== undefined && options.body !== null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData) {
    const h = options.headers as any;
    if (!h?.["Content-Type"] && !h?.["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const mergedHeaders = {
    ...headers,
    ...(options.headers ?? {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: mergedHeaders,
    });
  } catch (err) {
    let msg: string;
    if (isNetworkError(err)) {
      msg = isProduction()
        ? "No se pudo conectar. Revisá tu conexión o intentá de nuevo en unos segundos."
        : `No se pudo conectar con el servidor. ¿Está corriendo el backend en ${API_BASE}?`;
    } else {
      msg = err instanceof Error ? err.message : "Network error";
    }
    throw new Error(msg);
  }

  // ✅ si expira token o no es válido, limpiamos y vamos a la landing
  if (res.status === 401) {
    localStorage.removeItem("token");
    if (window.location.pathname !== "/") window.location.href = "/";
  }

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;

    try {
      if (isJsonResponse(res)) {
        const body = await res.json();
        msg = body?.detail ?? body?.error ?? body?.message ?? msg;
      } else {
        const text = await res.text();
        // No mostrar HTML de error del servidor (p. ej. 404 de Express)
        if (text?.trim() && !text.trimStart().toLowerCase().startsWith("<!")) {
          msg = text.slice(0, 180);
        } else if (res.status === 404) {
          msg = "Service not available. Please try again later.";
        } else if (res.status >= 500) {
          msg = "Server error. Please try again later.";
        }
      }
    } catch {
      // ignore
    }

    throw new Error(msg);
  }

  if (res.status === 204) return undefined as T;

  if (!isJsonResponse(res)) {
    return (await res.text()) as unknown as T;
  }

  return (await res.json()) as T;
}