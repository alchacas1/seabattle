import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const functionsOutput = join(repositoryRoot, "functions", "lib");

describe("Cloud Functions deployment package", () => {
  test("does not leave private workspace packages as runtime imports", () => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const args =
      process.platform === "win32"
        ? ["/d", "/s", "/c", "npm run build -w @sea-battle/functions"]
        : ["run", "build", "-w", "@sea-battle/functions"];

    execFileSync(command, args, { cwd: repositoryRoot, stdio: "pipe" });

    const emittedJavaScript = readdirSync(functionsOutput, {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
      .join("\n");

    expect(emittedJavaScript).not.toMatch(
      /(?:from\s+|import\s*\()["']@sea-battle\//,
    );
  });
});
