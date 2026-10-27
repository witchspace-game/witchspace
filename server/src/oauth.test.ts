import { describe, expect, it } from 'vitest';
import { handle } from '../../src/mcp/protocol';
import type { McpData } from '../../src/mcp/tools';
import { buildTools, type AsAccount } from './mcpBuild';
import { authServerMetadata, connectPage, isMetadataUrl, issuerOf, redirectMatches, protectedResourceMetadata, redirectOk, s256, verifierOk, withParams } from './oauth';

const ISSUER = 'https://space.witchspace.org.uk';

describe('the metadata clients read', () => {
  it('points the signed-in address at us, and us at our endpoints, PKCE only', () => {
    expect(protectedResourceMetadata(ISSUER)).toMatchObject({ resource: `${ISSUER}/mcp/build`, authorization_servers: [ISSUER], scopes_supported: ['submit'] });
    const as = authServerMetadata(ISSUER);
    expect(as).toMatchObject({ issuer: ISSUER, authorization_endpoint: `${ISSUER}/oauth/authorize`, token_endpoint: `${ISSUER}/oauth/token`, registration_endpoint: `${ISSUER}/oauth/register` });
    expect(as.code_challenge_methods_supported).toEqual(['S256']);
    expect(as.token_endpoint_auth_methods_supported).toEqual(['none']);
  });

  it('is always the live server, unless set to this machine for wrangler dev', () => {
    expect(issuerOf()).toBe(ISSUER);
    expect(issuerOf('https://evil.example')).toBe(ISSUER);
    expect(issuerOf('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787');
  });

  it('signs in on the live site, or the local one when the server is local', () => {
    expect(connectPage(ISSUER)).toBe('https://witchspace.org.uk/connect/');
    expect(connectPage('http://127.0.0.1:8787')).toBe('http://localhost:5173/connect/');
  });
});

describe('PKCE', () => {
  it('matches the RFC 7636 example', async () => {
    expect(await s256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(verifierOk('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(true);
    expect(verifierOk('too-short')).toBe(false);
  });
});

describe('where a client may be sent back to', () => {
  it('https anywhere, http only on this machine, never a fragment', () => {
    expect(redirectOk('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(redirectOk('http://localhost:6274/oauth/callback')).toBe(true);
    expect(redirectOk('http://127.0.0.1:33418/callback')).toBe(true);
    expect(redirectOk('http://evil.example/callback')).toBe(false);
    expect(redirectOk('https://claude.ai/cb#x')).toBe(false);
    expect(redirectOk('javascript:alert(1)')).toBe(false);
  });

  it('on this machine the port may differ, as Claude Code registers its addresses without one', () => {
    const claudeCode = ['http://localhost/callback', 'http://127.0.0.1/callback'];
    expect(redirectMatches(claudeCode, 'http://localhost:54321/callback')).toBe(true);
    expect(redirectMatches(claudeCode, 'http://127.0.0.1:61000/callback')).toBe(true);
    expect(redirectMatches(claudeCode, 'http://localhost:54321/elsewhere')).toBe(false);
    expect(redirectMatches(claudeCode, 'http://evil.example:54321/callback')).toBe(false);
    expect(redirectMatches(['https://claude.ai/api/mcp/auth_callback'], 'https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(redirectMatches(['https://claude.ai/api/mcp/auth_callback'], 'https://claude.ai:8443/api/mcp/auth_callback')).toBe(false);
  });

  it('keeps the address and adds the answer', () => {
    expect(withParams('https://claude.ai/api/mcp/auth_callback?x=1', { code: 'abc', state: 'st', error: undefined })).toBe('https://claude.ai/api/mcp/auth_callback?x=1&code=abc&state=st');
  });

  it('a client id that is an https address with a path is a metadata document', () => {
    expect(isMetadataUrl('https://claude.ai/oauth/claude-client.json')).toBe(true);
    expect(isMetadataUrl('wsc_abc')).toBe(false);
    expect(isMetadataUrl('https://example.com/')).toBe(false);
  });
});

describe('the signed-in tools', () => {
  const sub = { id: 'abc123def4', kind: 'module', itemId: 'ice-hold', title: 'Ice hold', revises: false, status: 'submitted', note: '', review: null, pr: null, version: 1, created: 0, updated: 0, warnings: [] };
  const calls: unknown[][] = [];
  const as: AsAccount = async (method, path, body) => {
    calls.push([method, path, body]);
    if (method === 'POST' && (body as { file: { id: string } }).file.id === 'broken') return { status: 400, data: { error: "It doesn't pass the checks yet", problems: ['length: must be >= 100'] } };
    if (method === 'POST') return { status: 201, data: { submission: sub } };
    if (path === '/submissions/mine') return { status: 200, data: { submissions: [{ ...sub, status: 'changes', review: 'Wider docks, please' }], limits: { today: 1, perDay: 5, waiting: 1, maxWaiting: 10 } } };
    return { status: 404, data: { error: 'No such submission' } };
  };
  const extra = buildTools(as, 'NOVA');
  const call = async (name: string, args: Record<string, unknown>) => (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, {} as McpData, '1', extra))!.result as { content: { text: string }[]; isError?: boolean };

  it('are listed beside the public ones, the writes not read-only, withdrawing destructive', async () => {
    const list = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {} as McpData, '1', extra))!.result as { tools: { name: string; annotations: Record<string, boolean> }[] };
    const byName = new Map(list.tools.map((t) => [t.name, t.annotations]));
    expect(byName.get('validate_ship')?.readOnlyHint).toBe(true);
    expect(byName.get('submit')?.readOnlyHint).toBe(false);
    expect(byName.get('withdraw')?.destructiveHint).toBe(true);
    expect(byName.get('my_submissions')?.readOnlyHint).toBe(true);
  });

  it('say who is signed in, and not to submit unasked', async () => {
    const init = (await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, {} as McpData, '1', extra))!.result as { instructions: string };
    expect(init.instructions).toContain('signed in as CMDR NOVA');
    expect(init.instructions).toContain('Never submit without being asked');
    expect(init.instructions).not.toContain('Nothing here changes anything');
  });

  it('hand in from the connector, AI-assisted', async () => {
    const r = await call('submit', { kind: 'module', file: { id: 'ice-hold' }, note: 'Cold' });
    expect(r.isError).toBeUndefined();
    expect(r.content[0].text).toMatch(/^Handed in\.\nIce hold/);
    expect(calls.at(-1)).toEqual(['POST', '/submissions', { kind: 'module', file: { id: 'ice-hold' }, note: 'Cold', ai: true, via: 'connector' }]);
  });

  it('pass the checks\' problems back as a list', async () => {
    const r = await call('submit', { kind: 'module', file: { id: 'broken' } });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('- length: must be >= 100');
  });

  it('show the reviewer\'s notes and the limits', async () => {
    const r = await call('my_submissions', {});
    expect(r.content[0].text).toContain('4 of 5 left today');
    expect(r.content[0].text).toContain("The reviewer's notes: Wider docks, please");
  });

  it('want a proper id', async () => {
    expect((await call('withdraw', { id: '../x' })).isError).toBe(true);
  });
});
