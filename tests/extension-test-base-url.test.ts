import { afterEach, describe, expect, it, vi } from 'vitest';
import { extensionIntegrationBaseUrl } from './extension-test-base-url';

describe('extensionIntegrationBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers BETTER_AUTH_BASE_URL over BETTER_AUTH_URL when integration override unset', () => {
    vi.stubEnv('EXTENSION_INTEGRATION_BASE_URL', '');
    vi.stubEnv('BETTER_AUTH_URL', 'https://auth-fallback.example');
    vi.stubEnv('BETTER_AUTH_BASE_URL', 'https://dashboard.example');
    expect(extensionIntegrationBaseUrl()).toBe('https://dashboard.example');
  });

  it('uses EXTENSION_INTEGRATION_BASE_URL when set', () => {
    vi.stubEnv('EXTENSION_INTEGRATION_BASE_URL', 'https://custom-api.example/path/');
    vi.stubEnv('BETTER_AUTH_BASE_URL', 'https://dashboard.example');
    expect(extensionIntegrationBaseUrl()).toBe('https://custom-api.example/path');
  });

  it('strips trailing slashes', () => {
    vi.stubEnv('BETTER_AUTH_BASE_URL', 'https://app.example///');
    expect(extensionIntegrationBaseUrl()).toBe('https://app.example');
  });

  it('falls back to BETTER_AUTH_URL when other dashboard vars unset', () => {
    vi.stubEnv('EXTENSION_INTEGRATION_BASE_URL', '');
    vi.stubEnv('BETTER_AUTH_BASE_URL', '');
    vi.stubEnv('BETTER_AUTH_URL', 'https://only-auth-url.example');
    expect(extensionIntegrationBaseUrl()).toBe('https://only-auth-url.example');
  });
});
