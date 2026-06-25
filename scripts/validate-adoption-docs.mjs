import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "AOC_READINESS_REPORT.md",
  "AOC_ADOPTION_PLAN.md",
  "AOC_GAP_REGISTER.md",
  "AOC_ADOPTION_ISSUES.md",
  ".github/ISSUE_TEMPLATE/aoc-adoption-issue.yml",
  "docs/adoption-workflow.md",
  "docs/architecture.md",
  "docs/data-model.md",
  "docs/security.md",
  "docs/audit.md",
  "docs/identity.md",
  "docs/app-contract.md",
  "docs/progress.md",
  "docs/runbook.md",
  "docs/support.md",
  "docs/user-guide.md",
  "docs/oversight.md"
];

const requiredHeadings = new Map([
  [
    "AOC_READINESS_REPORT.md",
    [
      "# AOC Readiness Report",
      "## App Summary",
      "## Classification",
      "## Data And Integration Assessment",
      "## Deployment Readiness",
      "## Oversight Signals",
      "## Readiness Outcome"
    ]
  ],
  [
    "AOC_ADOPTION_PLAN.md",
    [
      "# AOC Adoption Plan",
      "## Target State",
      "## Workstreams",
      "## Transformation Steps",
      "## Validation Plan",
      "## Deployment Plan",
      "## Handover"
    ]
  ],
  [
    "AOC_GAP_REGISTER.md",
    [
      "# AOC Gap Register",
      "## Open Gaps",
      "## Deferred Decisions",
      "## Risk Treatment",
      "## Closure Rules"
    ]
  ],
  [
    "AOC_ADOPTION_ISSUES.md",
    [
      "# AOC Adoption Issues",
      "## Issue Capture Rules",
      "## Categories",
      "## Adoption Context",
      "## Open Issues",
      "## Issue Details",
      "## Closed Issues"
    ]
  ],
  [
    "docs/adoption-workflow.md",
    [
      "# Adoption Workflow",
      "## Purpose",
      "## Required Inputs",
      "## Adoption Outputs",
      "## Agent Process",
      "## Validation Gates",
      "## Adoption Issue Capture",
      "## Completion Criteria"
    ]
  ]
]);

const requiredSnippets = new Map([
  [
    ".github/ISSUE_TEMPLATE/aoc-adoption-issue.yml",
    [
      "name: AOC adoption issue",
      "labels:",
      "aoc-adoption",
      "needs-triage",
      "id: client-repo",
      "id: template-version",
      "id: category",
      "id: evidence",
      "id: blocks",
      "id: escalation"
    ]
  ]
]);

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    failures.push(`${file} is required.`);
    continue;
  }

  const text = readFileSync(file, "utf8");
  if (text.trim().length === 0) {
    failures.push(`${file} must not be empty.`);
    continue;
  }

  for (const heading of requiredHeadings.get(file) ?? []) {
    if (!text.includes(heading)) {
      failures.push(`${file} must include heading: ${heading}`);
    }
  }

  for (const snippet of requiredSnippets.get(file) ?? []) {
    if (!text.includes(snippet)) {
      failures.push(`${file} must include: ${snippet}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Adoption documentation validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Adoption documentation validation passed.");
