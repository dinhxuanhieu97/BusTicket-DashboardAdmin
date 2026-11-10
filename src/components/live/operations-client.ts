export async function operation<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const res = await fetch("/api/operations/" + path, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: {
            "Content-Type": "application/json",
            ...(key ? { "Idempotency-Key": key } : {}),
          },
          body: JSON.stringify(body),
        }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message ?? "Không thực hiện được thao tác.");
  return data;
}
