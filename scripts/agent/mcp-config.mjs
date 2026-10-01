const json = value => JSON.stringify(value, null, 2) + '\n';
export const workbenchMcpServer = 'workbench';

export function projectMcpFiles() {
  return [
    {
      path: '.mcp.json',
      content: json({ mcpServers: { [workbenchMcpServer]: {
        command: 'node',
        args: ['${CLAUDE_PROJECT_DIR}/bin/app', 'mcp'],
      } } }),
    },
    {
      path: '.codex/config.toml',
      content: `# Project-local Workbench MCP. Codex loads project config only after the project is trusted.
[mcp_servers.workbench]
command = "node"
args = ["bin/app", "mcp"]
cwd = "."
startup_timeout_sec = 10
default_tools_approval_mode = "writes"
`,
    },
  ];
}

export function setupMcpFiles() {
  return [
    ...projectMcpFiles(),
    {
      path: '.claude/settings.local.json',
      content: json({
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: { allow: ['mcp__workbench'] },
      }),
    },
  ];
}
