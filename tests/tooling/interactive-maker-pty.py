"""Exercise the actual CLI on an OS pseudo-terminal; no pip package is needed."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import pty
import select
import signal
import struct
import subprocess
import tempfile
import termios
import time
import fcntl


class Terminal:
    def __init__(self, node, repo, root):
        self.master, self.slave = pty.openpty()
        self.original = termios.tcgetattr(self.slave)
        self.events = []
        self.snapshots = {}
        self.transcript = b""
        self.started = time.monotonic()
        self.resize(110, 30)
        env = dict(os.environ, TERM="xterm-256color", NO_COLOR="1", NODE_NO_WARNINGS="1")
        # This is intentionally a human-session test, not ambient CI auto-selection.
        for key in ["CI", "SHELL_ACCESSIBLE", "SHELL_UI"]:
            env.pop(key, None)
        self.process = subprocess.Popen(
            [node, "--experimental-strip-types", str(repo / "shell.mjs"),
             "studio", "--root", str(root), "--ui", "tui", "--no-color"],
            stdin=self.slave, stdout=subprocess.PIPE, stderr=self.slave,
            cwd=repo, env=env,
        )

    def resize(self, columns, rows):
        fcntl.ioctl(self.slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, columns, 0, 0))
        if hasattr(self, "process"):
            os.kill(self.process.pid, signal.SIGWINCH)

    def read(self, timeout=0.1):
        if select.select([self.master], [], [], timeout)[0]:
            block = os.read(self.master, 65536)
            self.transcript += block
            self.events.append([round(time.monotonic() - self.started, 4), "o", block.decode("utf-8", "replace")])

    def expect(self, fragment, offset=0):
        limit = time.monotonic() + 20
        expected = fragment.encode()
        while expected not in self.transcript[offset:]:
            if time.monotonic() >= limit or self.process.poll() is not None:
                raise AssertionError(f"Missing terminal output {fragment!r}; tail={self.transcript[-1200:]!r}")
            self.read()

    def send(self, text, next_screen=None):
        offset = len(self.transcript)
        os.write(self.master, text.encode())
        if next_screen:
            self.expect(next_screen, offset)

    def capture(self, name):
        self.snapshots[name] = self.transcript.decode("utf-8", "replace")

    def finish(self, expected):
        limit = time.monotonic() + 10
        while self.process.poll() is None and time.monotonic() < limit:
            self.read()
        assert self.process.poll() == expected, f"Expected exit {expected}; got {self.process.poll()}"
        while select.select([self.master], [], [], 0)[0]:
            self.read(0)
        assert self.process.stdout.read() == b"", "TUI polluted machine stdout"
        assert termios.tcgetattr(self.slave) == self.original, "Terminal attributes were not restored"
        assert b"\x1b[?1049h" in self.transcript
        assert b"\x1b[?2004l\x1b[?25h\x1b[0m\x1b[?1049l" in self.transcript
        return {"exitCode": expected, "stdoutEmpty": True, "termiosRestored": True,
                "cursorAndScreenRestored": True, "transcriptSha256": hashlib.sha256(self.transcript).hexdigest()}

    def close(self):
        if self.process.poll() is None:
            self.process.kill()
            self.process.wait(timeout=5)
        self.process.stdout.close()
        os.close(self.master)
        os.close(self.slave)

    def retain(self, directory, name):
        (directory / f"{name}.ansi").write_bytes(self.transcript)
        cast = [{"version": 2, "width": 110, "height": 30, "title": f"Shell maker: {name}"}, *self.events]
        (directory / f"{name}.cast").write_text("\n".join(json.dumps(item) for item in cast) + "\n")
        for screen, text in self.snapshots.items():
            (directory / f"{name}-{screen}.ansi").write_text(text)


def author(node, repo, target, evidence):
    terminal = Terminal(node, repo, target)
    try:
        terminal.expect("Project title")
        terminal.send("TUI smoke", "TUI smoke")
        offset = len(terminal.transcript)
        terminal.resize(40, 10)
        terminal.expect("Resize to at least", offset)
        terminal.capture("small-window")
        terminal.send("\x1b[200~invisible edit\x1b[201~\r")
        terminal.read(0.05)
        offset = len(terminal.transcript)
        terminal.resize(110, 30)
        terminal.expect("Project title", offset)
        terminal.send("\r", "What would you like")
        terminal.capture("workspace")
        terminal.send("\r", "Page title")
        terminal.send("Overview\r", "Sketch this page")
        terminal.send("/bulk\r", "Bulk-create components")
        terminal.send("\x1b[200~Card\nFilters\x1b[201~\r", "Sketch this page")
        terminal.capture("page")
        terminal.send("\x1bOP", "KEYBOARD GUIDE")
        terminal.capture("help")
        terminal.send("\x1b", "Create and add a component")
        terminal.send("\x1b", "What would you like")
        terminal.send("/save\r", "Review before writing")
        terminal.capture("review")
        terminal.send("\t", "Companion JSON")
        terminal.send("\r", "Apply this reviewed plan?")
        terminal.send("\r", "What would you like")  # No is the default.
        assert not (target / "design/project.json").exists(), "Review implied write approval"
        terminal.send("/save\r", "Review before writing")
        terminal.send("\r", "Apply this reviewed plan?")
        terminal.send("\x1b[B\r", "What would you like")
        terminal.capture("saved")
        terminal.send("/exit\r")
        result = terminal.finish(0)
        project = json.loads((target / "design/project.json").read_text())
        assert project["project"]["name"] == "TUI smoke", "Hidden paste changed the title"
        assert project["design"]["nodes"][0]["label"] == "Overview"
        assert len(project["design"]["visualDesigns"]["components"]) == 2
        result["projectSha256"] = hashlib.sha256((target / "design/project.json").read_bytes()).hexdigest()
        return result
    finally:
        terminal.retain(evidence, "authoring")
        terminal.close()


def agent_parity(node, repo, target, human):
    request = {"schemaVersion": 1, "title": "TUI smoke", "operations": [
        {"op": "page.add", "title": "Overview", "as": "page"},
        {"op": "page.attach", "page": "@page", "components": [{"title": "Card"}, {"title": "Filters"}]},
    ]}
    command = [node, "--experimental-strip-types", str(repo / "shell.mjs"), "sketch", "--root", str(target),
               "--input", "-", "--json", "--no-interaction"]
    preview = subprocess.run(command, input=json.dumps(request), text=True, capture_output=True, timeout=30, cwd=repo)
    assert preview.returncode == 0, preview.stderr + preview.stdout
    response = json.loads(preview.stdout)
    assert response["status"] == "planned"
    applied = subprocess.run(command + ["--apply", response["data"]["planHash"]], input=json.dumps(request),
                             text=True, capture_output=True, timeout=30, cwd=repo)
    assert applied.returncode == 0, applied.stderr + applied.stdout
    assert json.loads(applied.stdout)["status"] == "applied"
    assert (target / "design/project.json").read_bytes() == (human / "design/project.json").read_bytes()
    return {"status": "passed", "byteIdentical": True}


def cancel(node, repo, target, evidence, mode):
    terminal = Terminal(node, repo, target)
    try:
        terminal.expect("Project title")
        terminal.send("Unsaved draft", "Unsaved draft")
        if mode == "keyboard":
            terminal.send("\x03")
        else:
            os.kill(terminal.process.pid, signal.SIGTERM)
        result = terminal.finish(130)
        assert not (target / "design/project.json").exists()
        return result
    finally:
        terminal.retain(evidence, mode)
        terminal.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", required=True)
    parser.add_argument("--repo", default=".")
    parser.add_argument("--out", default="reports/maker-pty")
    args = parser.parse_args()
    repo, output = Path(args.repo).resolve(), Path(args.out).resolve()
    output.mkdir(parents=True, exist_ok=True)
    result = {"kind": "maker-real-pty", "status": "failed", "platform": os.uname().sysname}
    try:
        with tempfile.TemporaryDirectory(prefix="maker-pty-") as scratch:
            roots = {name: Path(scratch).resolve() / name for name in ["human", "agent", "keyboard", "signal"]}
            for path in roots.values():
                path.mkdir()
            result["authoring"] = author(args.node, repo, roots["human"], output)
            result["agentParity"] = agent_parity(args.node, repo, roots["agent"], roots["human"])
            for mode in ["keyboard", "signal"]:
                result[mode] = cancel(args.node, repo, roots[mode], output, mode)
            result["status"] = "passed"
    finally:
        (output / "report.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
