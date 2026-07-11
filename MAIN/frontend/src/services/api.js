async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : { message: await response.text().catch(() => "") };

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function apiGet(path) {
  const response = await fetch(path, {
    credentials: "include"
  });

  return parseResponse(response);
}

export async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function apiPut(path, payload) {
  const response = await fetch(path, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function apiPatch(path, payload) {
  const response = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse(response);
}

export async function apiDelete(path) {
  const response = await fetch(path, {
    method: "DELETE",
    credentials: "include"
  });

  return parseResponse(response);
}
