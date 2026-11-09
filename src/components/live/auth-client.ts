"use client";
export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function authPost(path: string, body: unknown = {}) {
  let res: Response;
  try {
    res = await fetch("/api/auth/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ClientError(
      "NETWORK_ERROR",
      "Không thể kết nối. Vui lòng thử lại.",
      0,
    );
  }
  const data = await res.json();
  if (!res.ok)
    throw new ClientError(
      data.error?.code || "API_ERROR",
      data.error?.message || "Không thể thực hiện yêu cầu.",
      res.status,
    );
  return data;
}
