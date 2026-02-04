import { api } from "./api";

export async function register(email: string, password: string) {
  return api<{ id: string; email: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string) {
  return api<{ token: string; user: { id: string; email: string } }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
}
