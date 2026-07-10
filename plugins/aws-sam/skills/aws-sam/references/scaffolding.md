# Scaffolding SAM Projects

Use this when the user wants to start a new AWS SAM project, or add a new function to an existing one.

## Default project layout (Node.js/TypeScript)

```
project-root/
├── template.yaml                     # root stack; declares nested stacks via AWS::CloudFormation::Stack
├── samconfig.toml
├── package.json                      # root-level: shared devDependencies (typescript, aws-sam types, test tooling)
├── tsconfig.json
├── .gitignore
├── handlers/
│   └── <service-name>/               # one Lambda per service/use-case, not per action — e.g. identity/
│       ├── package.json              # each handler is isolated — its own runtime deps
│       └── index.ts                  # entry point; routes internally by path/method — see lambda-standards.md
│                                      # each leaf file gets a colocated <name>.test.ts and <name>.event.json — see lambda-standards.md's Testing section
├── infrastructure/
│   └── <nested-stack-name>.yaml      # CloudFormation templates, wired up as nested stacks from template.yaml
├── website/                          # optional — only present when the project has a static site component
│   └── ...                           # deployed separately via `aws s3 sync`, not through SAM
└── layers/
    └── common/
        ├── Makefile               # ContentUri root — SAM runs `make build-CommonLayer` during `sam build`
        ├── package.json           # devDependencies for the layer's own build (esbuild, typescript)
        └── src/
            ├── logger/
            │   ├── index.ts       # actual TypeScript source, checked into git
            │   └── package.json   # copied into the build output as-is
            └── config/            # additional shared modules follow the same pattern
                ├── index.ts
                └── package.json
```

`nodejs/node_modules/...` isn't part of the source tree at all — it only exists as build output after `sam build` runs the layer's Makefile (see below). What's checked into git is the `src/` folder, with one subfolder per shared module (`logger`, `config`, and any future additions).

Handlers live one-per-folder under top-level `handlers/` (not `src/functions/`), but each folder is a **service or use-case**, not a single action — one Lambda can handle multiple paths and HTTP methods internally, routed via nested `index.ts` files (full pattern in `lambda-standards.md`'s Handler shape section). Each handler is isolated — its own `package.json` with its own runtime dependencies, not a single shared dependency tree. This lines up with esbuild's per-function bundling (each function resource can have its own `Metadata.BuildMethod: esbuild` config, bundling only what that handler actually imports). A root-level `package.json` still exists for shared devDependencies (TypeScript, `@types/aws-lambda`, test tooling) that apply across the whole project rather than to any one handler. CloudFormation resources are broken out into `infrastructure/*.yaml` files and wired into `template.yaml` as nested stacks (`AWS::CloudFormation::Stack`, `TemplateURL` pointing at the local file — SAM CLI uploads these to S3 automatically during `sam package`/`sam deploy`). If a project has a static site component, it lives in `website/` and is deployed independently with `aws s3 sync`, not through the SAM stack itself.

Shared code (utilities, shared types, common SDK client setup — e.g. the shared logger in `lambda-standards.md`) is factored into a Lambda layer under `layers/common/`, rather than duplicated into every handler's own `package.json`. The layer is declared in `template.yaml` as an `AWS::Serverless::LayerVersion` resource with `Metadata: BuildMethod: makefile`, and each handler that needs it lists it under that function's `Layers:` property.

That layer resource's `ContentUri` points at `layers/common/`, which must contain a file named exactly `Makefile` with a target named `build-<LayerLogicalId>` (e.g. `build-CommonLayer`). During `sam build`, SAM runs that target and expects the final build output written to the `$(ARTIFACTS_DIR)` environment variable it provides — the Makefile is responsible for both compiling the TypeScript source and placing the result at the path Node's runtime resolver expects: `nodejs/node_modules/<package-name>/`. Since the project uses ESM, each shared module has to land there as a real package (its own `package.json` with `"type": "module"`) rather than a loose file — ESM's resolver doesn't respect `NODE_PATH` the way CommonJS's `require` does, so only a proper `node_modules` package resolves via `import`.

```makefile
# layers/common/Makefile
build-CommonLayer:
	mkdir -p "$(ARTIFACTS_DIR)/nodejs/node_modules/logger"
	npx esbuild src/logger/index.ts --bundle --platform=node --format=esm \
	  --outfile="$(ARTIFACTS_DIR)/nodejs/node_modules/logger/index.js"
	cp src/logger/package.json "$(ARTIFACTS_DIR)/nodejs/node_modules/logger/package.json"
	mkdir -p "$(ARTIFACTS_DIR)/nodejs/node_modules/env-config"
	npx esbuild src/config/index.ts --bundle --platform=node --format=esm \
	  --outfile="$(ARTIFACTS_DIR)/nodejs/node_modules/env-config/index.js"
	cp src/config/package.json "$(ARTIFACTS_DIR)/nodejs/node_modules/env-config/package.json"
```

Files under `infrastructure/` are named by service/resource group, not by individual resource type — one file bundles everything needed to stand up that service as a cohesive unit. Example: `cloudfront.yaml` contains the CloudFront distribution, its origin S3 bucket, the ACM certificate, and the Route53 DNS record together, since they're deployed and reasoned about as one piece — not split across separate `s3.yaml`/`acm.yaml`/`route53.yaml` files. Similarly, a REST API Gateway (when SAM's implicit API isn't sufficient) gets its own `api-gateway.yaml` with all of its associated resources. `template.yaml` itself stays scoped to SAM-native resources (`AWS::Serverless::Function`, etc.) plus the `AWS::CloudFormation::Stack` declarations that wire in the nested stacks — plain CloudFormation resources don't get added directly to the root template.

`website/` deployment is triggered via an npm script that syncs to S3 and busts the CloudFront cache in one step:

```json
"scripts": {
  "deploy:website": "aws s3 sync ./website/ s3://${WEBSITE_BUCKET_NAME}/ --delete && aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths '/*'"
}
```

Run as `WEBSITE_BUCKET_NAME=my-bucket CLOUDFRONT_DISTRIBUTION_ID=EXXXXXXXXXXX npm run deploy:website` (or export both vars first). The `&&` means invalidation only runs if the sync succeeds.

`WEBSITE_BUCKET_NAME` and `CLOUDFRONT_DISTRIBUTION_ID` are supplied as env vars, passed by hand each deploy — not looked up dynamically from CloudFormation. A dynamic lookup via `aws cloudformation describe-stacks` would still require knowing which environment's stack to query, so it trades one manual input for another plus an extra API call and a separate shell script to maintain; passing the values directly is simpler.

## Bundling

Bundling uses esbuild via SAM's built-in `Metadata.BuildMethod: esbuild` on each function resource — not webpack. For any handler that pulls a package from the shared layer at `layers/common/`, that package needs to be listed under esbuild's `Metadata.BuildProperties.External` on that function resource — otherwise esbuild either fails to resolve it (since it's not in the handler's own `node_modules`) or bundles a redundant copy instead of relying on the one already present at `/opt/nodejs/node_modules` from the layer.

## Baseline commands

- `sam init` — only for brand-new projects; prefer copying the established layout above for consistency over the interactive wizard's defaults.
- `sam build` — before every local test or deploy.
- `sam local invoke <FunctionLogicalId> -e handlers/<service-name>/<path>/<name>.event.json` — for local testing against a sample event, e.g. `sam local invoke IdentityFunction -e handlers/identity/user/get.event.json`.
- `sam deploy --config-env dev` / `sam deploy --config-env prd` — deploy parameters, tags, and stack name are already predefined per environment in `samconfig.toml` (see `template-review.md`'s Parameters and environment separation section), so the interactive `--guided` wizard generally isn't needed once `samconfig.toml` exists. `--guided` is only for the very first time setting up `samconfig.toml` itself.

## Naming conventions

Handler folders use kebab-case, named for the **service/use-case** they handle — not the individual action. A Lambda covering `/user` and `/group` under one identity-related service would be `handlers/identity/`, not split into `handlers/create-user/`, `handlers/get-user/`, etc. Path segments and methods beneath it follow the structure in `lambda-standards.md`'s Handler shape section.

The corresponding Logical ID in `template.yaml` is the PascalCase version of the service folder name plus a `Function` suffix: `handlers/identity/` → `IdentityFunction`. This extends the same `<Name><ResourceType>` pattern already used for nested stacks — the `cloudfront.yaml` nested stack mentioned above, for example, is wired into `template.yaml` as `CloudFrontStack` — to every resource type: `UsersTable`, `WebsiteBucket`, `ApiRole`, etc. It's also close to forced: CloudFormation Logical IDs only allow alphanumeric characters, so kebab-case isn't valid there regardless.

| Handler folder | Logical ID |
|---|---|
| `handlers/identity/` | `IdentityFunction` |
| `handlers/orders/` | `OrdersFunction` |
| `handlers/billing/` | `BillingFunction` |

Environment separation naming is covered separately, in `template-review.md`'s Parameters and environment separation section (`[dev]`/`[prd]` sections in `samconfig.toml`).

## package.json / tsconfig defaults

Runtime is Node 24, set as `Runtime: nodejs24.x` in `template.yaml` (and in each `AWS::Serverless::LayerVersion`'s `CompatibleRuntimes`). Node 24 in Lambda only supports async/await handlers — callback-style handlers (`exports.handler = (event, context, callback) => {}`) fail outright, so every handler must use the `async (event) => {}` shape already established in `lambda-standards.md`.

Module system is ESM, not CommonJS. Every `package.json` in the project sets `"type": "module"` — root, each `handlers/<name>/`, and each shared module's source under `layers/common/src/<name>/` (which gets copied as-is into the build output at `nodejs/node_modules/<name>/`). esbuild's `Metadata.BuildProperties` for each function resource should set `Format: esm` to match. `tsconfig.json` should target something ESM-appropriate for Node 24 (e.g. `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"target": "ES2023"` or later).

No monorepo tool — no npm workspaces, pnpm, or turborepo. Each `package.json` (root, per-handler, layer) stays fully independent; dependencies are installed separately in each folder rather than hoisted from a single root install.
