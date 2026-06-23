import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  buildDeploymentManifest,
  githubEnvironmentFromManifest,
  loadAppContract
} from "./app-contract.mjs";

main();

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = loadAppContract(args.contract ?? "app.yml");
  const manifest = buildDeploymentManifest(contract, {
    azureLocation: process.env.AZURE_LOCATION?.trim(),
    environment: args.environment ?? process.env.DEPLOY_ENV?.trim()
  });
  const outputPath = args.output ?? ".generated/deployment-manifest.json";

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const githubEnvPath = args.githubEnv;
  if (githubEnvPath) {
    appendGithubEnvironment(githubEnvPath, githubEnvironmentFromManifest(manifest));
  }

  console.log(`Generated deployment manifest for ${manifest.app.name} ${manifest.environment}: ${outputPath}`);
}

function appendGithubEnvironment(path, values) {
  const lines = Object.entries(values).map(([key, value]) => {
    const stringValue = String(value);
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`Invalid GitHub environment key: ${key}`);
    }
    if (/[\r\n]/.test(stringValue)) {
      throw new Error(`GitHub environment value for ${key} must be single-line.`);
    }
    return `${key}=${stringValue}`;
  });
  appendFileSync(path, `${lines.join("\n")}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    const inline = item.match(/^--([a-z-]+)=(.*)$/);
    if (inline) {
      args[toCamelCase(inline[1])] = inline[2];
      continue;
    }

    if (item.startsWith("--")) {
      const key = toCamelCase(item.slice(2));
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`${item} requires a value.`);
      }
      args[key] = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}
