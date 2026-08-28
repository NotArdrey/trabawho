import { spawn } from 'node:child_process';
import process from 'node:process';

let inputBuffer = Buffer.alloc(0);

function sendMessage(message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  sendMessage({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
}

function runRedesign(args) {
  return new Promise((resolve, reject) => {
    const cliArgs = ['scripts/ai-ui-agent/stitch-redesign.mjs'];

    if (args.prompt) cliArgs.push('--prompt', args.prompt);
    if (args.promptFile) cliArgs.push('--prompt-file', args.promptFile);
    if (args.sourceFile) cliArgs.push('--source-file', args.sourceFile);
    if (args.apply !== false) cliArgs.push('--apply');
    if (args.autoMerge) cliArgs.push('--auto-merge');
    if (args.dryRun) cliArgs.push('--dry-run');
    if (args.fullSuite) cliArgs.push('--full-suite');

    const child = spawn(process.execPath, cliArgs, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
      if (code === 0) resolve(output);
      else reject(new Error(output || `stitch-redesign exited with ${code}`));
    });
  });
}

async function handleRequest(message) {
  if (!message.id && message.method?.startsWith('notifications/')) return;

  try {
    if (message.method === 'initialize') {
      sendResult(message.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'trabawho-stitch-ui-bridge',
          version: '0.1.0',
        },
      });
      return;
    }

    if (message.method === 'tools/list') {
      sendResult(message.id, {
        tools: [
          {
            name: 'stitch_redesign',
            description: 'Send a UI redesign prompt to Stitch, apply the generated result, and verify with Playwright.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The redesign instruction sent to Stitch.',
                },
                promptFile: {
                  type: 'string',
                  description: 'Optional repository-relative prompt file.',
                },
                sourceFile: {
                  type: 'string',
                  description: 'Optional repository-relative Stitch JSON output file.',
                },
                apply: {
                  type: 'boolean',
                  default: true,
                  description: 'Write generated UI changes into the worktree.',
                },
                autoMerge: {
                  type: 'boolean',
                  default: false,
                  description: 'Create a branch, verify, commit, and fast-forward merge. Requires a clean worktree.',
                },
                fullSuite: {
                  type: 'boolean',
                  default: false,
                  description: 'Run the full Playwright suite after the redesign smoke test.',
                },
                dryRun: {
                  type: 'boolean',
                  default: false,
                  description: 'Load Stitch output without writing changes.',
                },
              },
              anyOf: [
                { required: ['prompt'] },
                { required: ['promptFile'] },
                { required: ['sourceFile'] }
              ],
            },
          },
        ],
      });
      return;
    }

    if (message.method === 'tools/call') {
      const { name, arguments: toolArgs = {} } = message.params || {};
      if (name !== 'stitch_redesign') {
        sendError(message.id, -32602, `Unknown tool: ${name}`);
        return;
      }

      const output = await runRedesign(toolArgs);
      sendResult(message.id, {
        content: [
          {
            type: 'text',
            text: output || 'Stitch redesign completed.',
          },
        ],
      });
      return;
    }

    sendError(message.id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    sendError(message.id, -32000, error.message);
  }
}

function readMessages() {
  while (true) {
    const headerEnd = inputBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const header = inputBuffer.subarray(0, headerEnd).toString('utf8');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      inputBuffer = inputBuffer.subarray(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (inputBuffer.length < bodyEnd) return;

    const rawBody = inputBuffer.subarray(bodyStart, bodyEnd).toString('utf8');
    inputBuffer = inputBuffer.subarray(bodyEnd);

    try {
      handleRequest(JSON.parse(rawBody));
    } catch (error) {
      sendError(null, -32700, error.message);
    }
  }
}

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  readMessages();
});
