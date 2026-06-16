export function createJsonRequest(url, body, options = {}) {
  return new Request(url, {
    method: options.method || 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  });
}

export function createGetRequest(url, options = {}) {
  return new Request(url, {
    method: 'GET',
    headers: options.headers || {},
  });
}

export async function readJson(response) {
  return response.json();
}
