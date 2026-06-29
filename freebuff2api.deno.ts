declare const Deno: {
  serve(
    options: { hostname: string; port: number },
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

import { CodebuffAccountPool, loadSettings } from "#freebuff";
import { createHandler } from "#server";

const settings = loadSettings();
const accounts = new CodebuffAccountPool(settings);
console.info(`configured freebuff accounts count=${accounts.accountCount}`);

Deno.serve(
  { hostname: settings.host, port: settings.port },
  createHandler(settings, accounts),
);
