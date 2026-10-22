import { identity, httpsOrigin } from "./deployment-config.mjs";

export function previewName(repositoryId, number) {
  if (!/^[1-9]\d*$/.test(repositoryId ?? "") || !/^[1-9]\d*$/.test(number ?? ""))
    throw new Error("Numeric repository ID and PR number are required");
  return `rm-${repositoryId}-pr-${number}`;
}

export function validatePreview(lock, owner, env = process.env) {
  const config = identity(lock);
  const name = previewName(env.GITHUB_REPOSITORY_ID, env.PR_NUMBER);
  if (
    owner.repository !== env.GITHUB_REPOSITORY ||
    owner.repositoryId !== env.GITHUB_REPOSITORY_ID ||
    owner.pr !== env.PR_NUMBER ||
    owner.worker !== name ||
    owner.databaseId !== config.d1_databases[0].database_id
  ) {
    throw new Error("Preview ownership does not match the requested repository and PR");
  }
  if (
    config.name !== name ||
    config.account_id !== env.CLOUDFLARE_ACCOUNT_ID ||
    config.d1_databases[0].database_name !== `${name}-db`
  )
    throw new Error("Preview resources do not match their reviewed identity");
  if (
    httpsOrigin(owner.origin) !== httpsOrigin(env.APP_URL) ||
    config.vars?.API_ORIGIN !== owner.origin
  )
    throw new Error("Preview origin mismatch");
  // Previews expose only the reviewed workers.dev hostname; no shared custom routes.
  if (
    config.workers_dev !== true ||
    config.routes?.length !== 0 ||
    config.route ||
    owner.origin !== `https://${name}.${env.CLOUDFLARE_WORKERS_SUBDOMAIN}.workers.dev`
  )
    throw new Error("Unexpected preview route");
  return config;
}
