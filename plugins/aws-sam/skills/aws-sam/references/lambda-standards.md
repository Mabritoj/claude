# Lambda Function Code Standards (Node.js/TypeScript)

Use this when writing, refactoring, or reviewing a Lambda handler.

## Handler shape

Each Lambda is scoped to a service/use-case, not a single action — it can handle multiple paths and methods internally. `index.ts` at each level is a router, not business logic: it inspects the incoming request and dispatches deeper, until the leaf-level file with the actual logic is reached. Folders track URL path depth only; HTTP methods are flat files within whichever folder represents that depth — there's no folder per method.

A path parameter (like `{id}`) is a routing detail handled inside the relevant `index.ts`, not a folder of its own — check `event.pathParameters` to decide whether a request is for a single item or a collection.

```
handlers/identity/
├── index.ts              # routes by top-level path: /user vs /group
├── user/
│   ├── index.ts          # routes by method, and by whether {id} is present
│   ├── list.ts            # GET /user (collection)
│   ├── get.ts              # GET /user/{id} (single item) — plus get.test.ts, get.event.json alongside it
│   ├── create.ts           # POST /user
│   ├── update.ts           # PUT /user/{id}
│   ├── delete.ts           # DELETE /user/{id}
│   └── permissions/        # deeper path segment: /user/{id}/permissions
│       ├── index.ts
│       ├── get.ts
│       └── update.ts
└── group/
    ├── index.ts
    ├── list.ts
    └── create.ts
```

```typescript
// handlers/identity/index.ts — top-level router: generates the correlation ID,
// creates the logger, and attaches the correlation ID header on the way out
import { randomUUID } from 'crypto';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from 'logger';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const correlationId = randomUUID();
  const logger = new Logger(correlationId);
  const path = event.resource;

  let result: APIGatewayProxyResult;
  if (path.startsWith('/user')) {
    result = await (await import('./user')).handler(event, logger);
  } else if (path.startsWith('/group')) {
    result = await (await import('./group')).handler(event, logger);
  } else {
    logger.warning('No route matched', { path });
    result = { statusCode: 404, body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }) };
  }

  return { ...result, headers: { ...result.headers, 'X-Correlation-Id': correlationId } };
};
```

```typescript
// handlers/identity/user/index.ts — routes by method, {id} presence, and deeper sub-paths;
// receives and forwards the logger rather than creating its own
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from 'logger';

export const handler = async (
  event: APIGatewayProxyEvent,
  logger: Logger
): Promise<APIGatewayProxyResult> => {
  const { httpMethod, pathParameters, resource } = event;

  if (resource.includes('/permissions')) {
    return (await import('./permissions')).handler(event, logger);
  }

  switch (httpMethod) {
    case 'GET':
      return pathParameters?.id
        ? (await import('./get')).handler(event, logger)
        : (await import('./list')).handler(event, logger);
    case 'POST':
      return (await import('./create')).handler(event, logger);
    case 'PUT':
      return (await import('./update')).handler(event, logger);
    case 'DELETE':
      return (await import('./delete')).handler(event, logger);
    default:
      logger.warning('Method not allowed', { httpMethod });
      return { statusCode: 405, body: JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }
};
```

```typescript
// handlers/identity/user/get.ts — leaf-level file: actual GET /user/{id} logic
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from 'logger';

export const handler = async (
  event: APIGatewayProxyEvent,
  logger: Logger
): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.id;
  logger.info('Fetching user', { userId });

  // business logic here

  return { statusCode: 200, body: JSON.stringify({ /* ... */ }) };
};
```

The routing mechanics shown (dynamic `import()`, reading `event.resource`/`event.pathParameters`) implement the structure above.

## Error handling

Catch at the handler boundary — every leaf-level file wraps its logic in try/catch, not an unhandled throw (which produces an opaque 502 from API Gateway). The error response body uses a nested `error` object with `code` and `message`:

```json
{ "error": { "code": "NOT_FOUND", "message": "User not found" } }
```

`code` is a short, stable, uppercase-with-underscores identifier (`NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`) that callers can branch on; `message` is the human-readable description. Errors are logged via `logger.error(...)` — with the correlation ID automatically attached, since it's baked into the logger instance — before the structured response is returned. The `X-Correlation-Id` header is attached the same way on error responses as on success responses, since that happens once at the top-level router regardless of how the request resolved below it.

```typescript
// handlers/identity/user/get.ts, extended with error handling
export const handler = async (
  event: APIGatewayProxyEvent,
  logger: Logger
): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.id;
  logger.info('Fetching user', { userId });

  try {
    // business logic here
    return { statusCode: 200, body: JSON.stringify({ /* ... */ }) };
  } catch (err) {
    logger.error('Failed to fetch user', { userId, error: (err as Error).message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } }),
    };
  }
};
```

## Logging

Structured JSON logging via `console.log(JSON.stringify(...))` — not a dedicated library like `aws-lambda-powertools` or `pino`. CloudWatch is queried directly, so no separate log aggregation tooling is layered on top.

The logger is a class with three methods — `info`, `warning`, `error` — and carries a **correlation ID**: a GUID generated once at the very start of a request (top-level `index.ts`, via Node's built-in `crypto.randomUUID()` — no extra dependency needed), threaded through every nested router and leaf file, included on every log line, and attached as a response header on the way back out — see Handler shape and Error handling above for how it flows through the call chain.

The logger class itself lives in the shared layer (`layers/common/`) rather than being reimplemented per handler. Its TypeScript source is checked in at `layers/common/src/logger/index.ts`; the layer's `Makefile` (see `scaffolding.md`'s Default project layout section) compiles it into `nodejs/node_modules/logger/` as build output during `sam build` — that compiled path isn't part of the source tree. Handlers import it by package name: `import { Logger } from 'logger'`. As with any layer-provided package, it also needs to be listed under esbuild's `Metadata.BuildProperties.External` on every function resource that imports it (see `scaffolding.md`'s Bundling section) — otherwise esbuild tries to bundle it locally instead of relying on the copy the layer provides at runtime.

```typescript
// layers/common/src/logger/index.ts
export class Logger {
  constructor(private correlationId: string) {}

  private write(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({
      level,
      message,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      ...meta,
    }));
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.write('INFO', message, meta);
  }

  warning(message: string, meta?: Record<string, unknown>) {
    this.write('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.write('ERROR', message, meta);
  }
}
```

## Typing

- Use the `@types/aws-lambda` event/result types rather than `any` for handler signatures.
- `strict: true` in `tsconfig.json`.
- Shared types (e.g. a `User` interface used across handlers) live in a dedicated `shared-types/` folder at the project root — not in the Lambda layer. Unlike the logger, types are compile-time only and get erased entirely once esbuild bundles the code, so they never need to be deployed to `/opt` the way runtime code does. They're referenced via a `tsconfig.json` path alias instead of an npm package:

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "paths": { "@shared-types": ["./shared-types/index.ts"] }
  }
}
```

```typescript
// handlers/identity/user/get.ts
import type { User } from '@shared-types';
```

Using `import type` (not a plain `import`) guarantees esbuild strips the import entirely at bundle time. This also works without npm workspaces, since it's a compiler path alias, not a package dependency — there's nothing to `npm install`.

## Environment variables

Naming is `SCREAMING_SNAKE_CASE` — the near-universal convention in this ecosystem.

Env vars are accessed through a typed, validated config helper — not raw `process.env` scattered through the code. The helper lives in the shared layer (`layers/common/`), same pattern as the logger: TypeScript source checked in at `layers/common/src/config/index.ts`, compiled by the layer's `Makefile` into `nodejs/node_modules/env-config/` as build output, and listed under esbuild's `Metadata.BuildProperties.External` on any function that imports it.

The helper validates every required env var once, at module load (same timing as a module-scope SDK client) — so a missing var fails immediately on cold start with a specific error naming which variable is missing, instead of failing later mid-request with `undefined` propagating into an SDK call.

```typescript
// layers/common/src/config/index.ts
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  usersTableName: requireEnv('USERS_TABLE_NAME'),
};
```

Elsewhere in the code, access is always `config.usersTableName` — a real `string`, never `string | undefined`, no `!` assertions needed. See the full example in Dependencies / AWS SDK below for this in context.

## Dependencies / AWS SDK

- AWS SDK v3, modular imports (`@aws-sdk/client-dynamodb` etc.), not the monolithic v2 SDK — v3 is what's bundled by esbuild efficiently and is AWS's current guidance.
- SDK clients are instantiated at **module scope** — the `new DynamoDBClient({})` line sits outside the `handler` function, not inside it. Lambda often reuses the same running process across consecutive invocations ("warm"); module-scope code runs once when that process starts and stays in memory, while handler-scope code reruns on every single invocation. Creating a client does real setup work, so doing it once and reusing it is cheaper than repeating it per request. This holds even with the dynamic-`import()` routing pattern in this project — Node caches a module the first time it's dynamically imported within a given warm container, so the client still gets created once per container, not once per invocation.

```typescript
// handlers/identity/user/get.ts
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from 'logger';
import { config } from 'env-config';

const ddbClient = new DynamoDBClient({}); // module scope — created once per warm container

export const handler = async (
  event: APIGatewayProxyEvent,
  logger: Logger
): Promise<APIGatewayProxyResult> => {
  const userId = event.pathParameters?.id;
  logger.info('Fetching user', { userId });

  try {
    const result = await ddbClient.send(new GetItemCommand({
      TableName: config.usersTableName,
      Key: { id: { S: userId! } },
    }));
    return { statusCode: 200, body: JSON.stringify(result.Item) };
  } catch (err) {
    logger.error('Failed to fetch user', { userId, error: (err as Error).message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user' } }),
    };
  }
};
```

This is the complete pattern: module-scope SDK client, the logger threaded in from the router, the validated config helper instead of raw `process.env`, and the confirmed error response shape — all four conventions from this file, in one function.

## Testing

Test framework is Jest. AWS SDK calls are mocked with `aws-sdk-client-mock`, not hit against real AWS resources — it patches the SDK client class's `send()` method, so tests stay fast and need no credentials or live dev environment. This works regardless of where the client is instantiated (module scope vs. per-invocation), since it patches the class rather than a specific instance.

A sample event payload for `sam local invoke` is colocated the same way — `get.event.json` beside `get.ts` and `get.test.ts` — rather than centralized in one file per service. A service handles many methods and paths, so one shared event file per service can't represent all of them; one per operation, living right next to that operation's code, can.

```typescript
// handlers/identity/user/get.test.ts
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { Logger } from 'logger';
import { handler } from './get';

const ddbMock = mockClient(DynamoDBClient);
const mockLogger = new Logger('test-correlation-id');
const mockEvent = { pathParameters: { id: '123' } } as unknown as APIGatewayProxyEvent;

beforeEach(() => ddbMock.reset());

test('returns a user by id', async () => {
  ddbMock.on(GetItemCommand).resolves({
    Item: { id: { S: '123' }, name: { S: 'Jonathan' } },
  });

  const result = await handler(mockEvent, mockLogger);

  expect(result.statusCode).toBe(200);
});
```

Mocked unit tests verify the code calls the SDK correctly, not that the real DynamoDB table, IAM permissions, or API Gateway integration are wired up right in AWS — that's what `sam local invoke` or a deployed dev stack are for, as a separate integration-testing layer.
