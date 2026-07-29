import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { serverEnv } from "@/lib/env.server";

function secretForEnv(env: ReturnType<typeof serverEnv>): string {
  switch (env.PLAID_ENV) {
    case "production":
      if (!env.PLAID_PRODUCTION_SECRET) throw new Error("PLAID_PRODUCTION_SECRET is not set.");
      return env.PLAID_PRODUCTION_SECRET;
    case "development":
      if (!env.PLAID_DEVELOPMENT_SECRET) throw new Error("PLAID_DEVELOPMENT_SECRET is not set.");
      return env.PLAID_DEVELOPMENT_SECRET;
    case "sandbox":
    default:
      if (!env.PLAID_SANDBOX_SECRET) throw new Error("PLAID_SANDBOX_SECRET is not set.");
      return env.PLAID_SANDBOX_SECRET;
  }
}

let cachedClient: PlaidApi | null = null;

/** Server-only Plaid API client, configured for whichever PLAID_ENV is active. */
export function getPlaidClient(): PlaidApi {
  if (cachedClient) return cachedClient;

  const env = serverEnv();
  if (!env.PLAID_CLIENT_ID) {
    throw new Error("PLAID_CLIENT_ID is not set.");
  }

  const configuration = new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": secretForEnv(env),
      },
    },
  });

  cachedClient = new PlaidApi(configuration);
  return cachedClient;
}
