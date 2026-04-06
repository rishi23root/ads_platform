/**
 * Stable extension end-user session: prefer login (cheap, safe under parallel runners), then register on 401.
 */
export async function registerOrLoginExtensionEndUser(
  baseUrl: string,
  email: string,
  password: string
): Promise<{ token: string; endUserId: string; userIdentifier: string }> {
  const readAuthBody = async (res: Response, label: string) => {
    const j = (await res.json()) as { token?: string; user?: { id?: string; identifier?: string } };
    const token = j.token ?? '';
    const endUserId = j.user?.id ?? '';
    const userIdentifier = j.user?.identifier ?? '';
    if (token.length <= 16 || !endUserId || !userIdentifier) {
      throw new Error(`${label}: missing token, user id, or identifier`);
    }
    return { token, endUserId, userIdentifier };
  };

  const loginRes = await fetch(`${baseUrl}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.status === 200) {
    return readAuthBody(loginRes, 'login');
  }

  if (loginRes.status !== 401) {
    const errText = await loginRes.text();
    throw new Error(`extension login failed: HTTP ${loginRes.status} ${errText.slice(0, 200)}`);
  }

  const regRes = await fetch(`${baseUrl}/api/extension/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (regRes.status === 201) {
    return readAuthBody(regRes, 'register');
  }

  if (regRes.status === 409) {
    const retryLogin = await fetch(`${baseUrl}/api/extension/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (retryLogin.status === 200) {
      return readAuthBody(retryLogin, 'login after 409');
    }
    const errText = await retryLogin.text();
    throw new Error(`login after duplicate register failed: HTTP ${retryLogin.status} ${errText.slice(0, 200)}`);
  }

  const errText = await regRes.text();
  throw new Error(`extension register failed: HTTP ${regRes.status} ${errText.slice(0, 200)}`);
}
