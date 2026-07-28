#!/usr/bin/env node
/**
 * Lightweight secret scanner for staged changes. Not a replacement for a
 * dedicated tool (gitleaks is wired into CI — see .github/workflows/ci.yml),
 * but it catches the common cases fast, locally, with zero extra install.
 */
import { execSync } from "node:child_process";

const PATTERNS = [
  { name: "Plaid secret", regex: /\b[a-f0-9]{30,}\b/i, contextHint: /plaid/i },
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Private key block", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Supabase secret key", regex: /sb_secret_[a-zA-Z0-9]{20,}/ },
  { name: "Supabase service_role JWT-ish", regex: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/ },
  { name: "Generic API key assignment", regex: /(api[_-]?key|secret|token)\s*[:=]\s*["'][a-zA-Z0-9_\-./+]{20,}["']/i },
];

function getStagedDiff() {
  try {
    return execSync("git diff --cached -U0 -- . ':(exclude)pnpm-lock.yaml'", { encoding: "utf8" });
  } catch {
    return "";
  }
}

function main() {
  const diff = getStagedDiff();
  if (!diff) {
    console.log("secret-scan: no staged changes to scan.");
    return;
  }

  const addedLines = diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"));

  const findings = [];
  for (const line of addedLines) {
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({ pattern: pattern.name, line: line.slice(0, 200) });
      }
    }
  }

  if (findings.length > 0) {
    console.error("secret-scan: possible secret(s) found in staged changes:\n");
    for (const finding of findings) {
      console.error(`  [${finding.pattern}] ${finding.line}`);
    }
    console.error("\nIf this is a false positive, rename the variable away from these patterns or use --no-verify with explicit justification.");
    process.exit(1);
  }

  console.log("secret-scan: no obvious secrets found in staged changes.");
}

main();
