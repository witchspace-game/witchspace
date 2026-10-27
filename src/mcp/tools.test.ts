import { describe, expect, it } from 'vitest';
import { compileSchemaCheck, loadMcpData } from '../../tools/mcp-data';
import { handle } from './protocol';
import { TOOLS, type McpData } from './tools';

const loaded = loadMcpData();
const data: McpData = { ...loaded, checkSchema: compileSchemaCheck(loaded.texts.schema) };
const cobra = () => structuredClone(data.ships.find((s) => s.id === 'cobra-mk3')!);
const call = async (name: string, args: Record<string, unknown>) => {
  const r = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, data, 'test');
  return r!.result as { content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };
};
const parsed = async (name: string, args: Record<string, unknown>) => JSON.parse((await call(name, args)).content[0].text!);

describe('MCP server', () => {
  it('introduces itself and lists its tools as read-only', async () => {
    const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, data, 'test');
    expect((init!.result as { serverInfo: { name: string } }).serverInfo.name).toBe('witchspace');
    const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, data, 'test');
    const tools = (list!.result as { tools: { name: string; annotations: { readOnlyHint: boolean } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
  });

  it("doesn't answer notifications, and errors on unknown methods", async () => {
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, data, 'test')).toBeNull();
    expect((await handle({ jsonrpc: '2.0', id: 3, method: 'nope' }, data, 'test'))!.error!.code).toBe(-32601);
  });

  it('passes every ship in the fleet (apart from the reminders)', async () => {
    for (const ship of data.ships) {
      const r = await parsed('validate_ship', { ship });
      expect(r.errors, ship.id).toEqual([]);
    }
  });

  it('finds schema and geometry problems, and takes the ship as text too', async () => {
    const bad = cobra();
    (bad.stats as Record<string, unknown>).maxSpeed = 'fast';
    bad.geometry.faces[0] = [0, 1, 99];
    const r = await parsed('validate_ship', { ship: JSON.stringify(bad) });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/maxSpeed must be number/);
    expect(r.errors.join(' ')).toMatch(/out of range/);
  });

  it('draws a ship as a PNG', async () => {
    const r = await call('preview_ship', { ship: data.ships.find((s) => s.id === 'falcon') });
    expect(r.content[0].mimeType).toBe('image/png');
    expect(atob(r.content[0].data!).slice(1, 4)).toBe('PNG');
  });

  it('flags a ship that is better at everything', async () => {
    const s = cobra();
    s.id = 'too-good';
    Object.assign(s.stats, { maxSpeed: 600, pitchRate: 3, rollRate: 4, hull: 900, shields: 900, cargo: 200 });
    const r = await parsed('balance_check', { ship: s });
    expect(r.notes.join(' ')).toMatch(/real weakness/);
  });

  it('looks up a system the way the game sees it', async () => {
    const lave = await parsed('galaxy_system', { name: 'lave' });
    expect(lave).toMatchObject({ name: 'Lave', galaxy: 1, index: 7, government: 'Dictatorship', station: 'Cambridge Orbital' });
    expect(lave.withinSevenLightYears.map((n: { name: string }) => n.name)).toContain('Leesti');
    const missing = await call('galaxy_system', { name: 'Nowhere' });
    expect(missing.isError).toBe(true);
  });

  it('serves the designs and help wanted from the doc headers', async () => {
    const building = await parsed('designs', { status: 'building' });
    expect(building.length).toBeGreaterThan(0);
    expect(building.every((d: { status: string }) => d.status === 'building')).toBe(true);
    const help = await parsed('help_wanted', { skill: 'writing' });
    expect(help.every((h: { skill: string }) => h.skill === 'writing')).toBe(true);
    const doc = await call('get_design', { slug: 'mcp-server' });
    expect(doc.content[0].text).toMatch(/Witchspace MCP server/);
  });

  it('shows a ship turning in the chat: the view named on the tool, the page served, the geometry for it', async () => {
    const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, data, 'test');
    const tool = (list!.result as { tools: { name: string; _meta?: { ui?: { resourceUri: string } } }[] }).tools.find((t) => t.name === 'view_ship')!;
    expect(tool._meta?.ui?.resourceUri).toBe('ui://witchspace/viewer.html');
    const page = await handle({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'ui://witchspace/viewer.html' } }, data, 'test');
    const content = (page!.result as { contents: { mimeType: string; text: string }[] }).contents[0];
    expect(content.mimeType).toBe('text/html;profile=mcp-app');
    expect(content.text).toContain("request('ui/initialize'");
    expect(content.text).toContain('ui/notifications/tool-result');
    expect([...content.text].every((c) => c.charCodeAt(0) < 128)).toBe(true); // plain ASCII, whatever the host's encoding
    expect(content.text).not.toMatch(/<script[^>]+src=|https?:\/\/(?!www\.w3)/); // self-contained: no network
    const r = (await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'view_ship', arguments: { id: 'falcon' } } }, data, 'test'))!.result as { content: { text: string }[]; structuredContent: { name: string; vertices: unknown[]; scale?: { name: string } } };
    expect(r.content[0].text).toMatch(/^Showing .+ turning in 3D/);
    expect(r.structuredContent.vertices.length).toBe(data.ships.find((s) => s.id === 'falcon')!.geometry.vertices.length);
    expect(r.structuredContent.scale?.name).toBe('Cobra Mk III');
    expect((await call('view_ship', { id: 'cobra-mk3' })).isError).toBeUndefined();
    expect((await call('view_ship', { id: 'no-such-ship' })).isError).toBe(true);
  });
});
