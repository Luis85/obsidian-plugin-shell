const json = value => JSON.stringify(value, null, 2) + '\n';
const workbenchMcpServer = 'workbench';

function projectMcpFiles() {
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
tool_timeout_sec = 600
enabled_tools = ["workbench_capabilities", "workbench_help", "workbench_execute"]
default_tools_approval_mode = "writes"

[mcp_servers.workbench.tools.workbench_capabilities]
approval_mode = "approve"

[mcp_servers.workbench.tools.workbench_help]
approval_mode = "approve"

[mcp_servers.workbench.tools.workbench_execute]
approval_mode = "prompt"
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
        permissions: {
          allow: ['mcp__workbench__workbench_capabilities', 'mcp__workbench__workbench_help'],
          ask: ['mcp__workbench__workbench_execute'],
        },
      }),
    },
  ];
}
