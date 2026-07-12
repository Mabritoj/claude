# template.yaml Review Checklist

Use this when reviewing, validating, or editing an existing `template.yaml`.

## Structural checks

- `template.yaml` is the root/orchestrating stack, scoped to SAM-native resources plus `AWS::CloudFormation::Stack` declarations that wire in nested stacks. The precise check for "does this resource belong here": its `Type` either **contains `::Serverless::`** (`AWS::Serverless::Function`, `AWS::Serverless::Api`, `AWS::Serverless::LayerVersion`, etc.) **or is exactly `AWS::CloudFormation::Stack`**. Anything else — any plain CloudFormation type that's neither of those — doesn't belong directly in the root; it goes in a service-grouped file under `infrastructure/` instead (e.g. `cloudfront.yaml` holding the distribution + origin bucket + cert + DNS record together). Note the nested-stack declarations themselves (`AWS::CloudFormation::Stack`) don't contain `::Serverless::` — a check that only looks for that substring would incorrectly flag every legitimate nested-stack resource as misplaced.
- `Globals` section used for settings shared across all functions (Runtime, MemorySize, Tracing) rather than repeating them on every function resource. `Timeout` defaults to **30 seconds** — one second above API Gateway's hard 29-second integration timeout, so the function isn't cut off by its own Lambda timeout before Gateway would time out anyway. A function that genuinely needs a different value should set `Timeout` at the resource level with a reason, not silently inherit a mismatched default.
- Each function resource and each nested stack resource has an explicit `LogicalId` that's descriptive (not `Function1`, `Stack1`).
- `Outputs` are used deliberately for cross-stack wiring, but the reach differs by consumer. If the **root template** needs a value a nested stack produces (e.g. a table ARN), that's one hop: export it via that nested stack's `Outputs`, then read it with `!GetAtt <NestedStackLogicalId>.Outputs.<Name>` directly in the root template. If a **sibling nested stack** needs it instead, that's two hops — the same pattern used for parameters below: the root reads the producing stack's `Outputs` via `!GetAtt`, then explicitly forwards that value into the consuming stack's `Parameters:` property (nested stacks can't `!GetAtt` each other directly; everything routes through the root). Flag any value that's hardcoded or looked up manually instead of wired this way.

## IAM

- Default to least-privilege: prefer SAM's policy templates (`SAMPolicyTemplate`, e.g. `DynamoDBCrudPolicy`) scoped to the specific resource, over broad managed policies like `AmazonDynamoDBFullAccess`. This shorthand only works on `AWS::Serverless::Function` (and other SAM-transform resources) in the **root** `template.yaml` — the SAM transform doesn't process `infrastructure/*.yaml`, since those are deployed as plain CloudFormation nested stacks. An IAM role or policy defined inside `infrastructure/` needs a full, explicit `AWS::IAM::Role`/`PolicyDocument` — the `Policies:` shorthand isn't available there.
- Flag any `Action: "*"` or unscoped `Resource: "*"` in an inline policy as something to confirm is intentional.

## Parameters and environment separation

Environment separation happens through named sections in `samconfig.toml` — `[dev]` and `[prd]` (not `[prod]`). Each environment's `deploy.parameters` table carries its own `parameter_overrides`, which feed values into the template's `Parameters:` block — including things like the S3 bucket name. Example:

```toml
version = 0.1

[dev]
[dev.deploy.parameters]
stack_name = "myapp-dev"
s3_prefix = "myapp-dev"
parameter_overrides = "BucketName=\"myapp-dev-website\" Environment=\"dev\""
tags = "BACKUP=\"myapp-dev\""

[prd]
[prd.deploy.parameters]
stack_name = "myapp-prd"
s3_prefix = "myapp-prd"
parameter_overrides = "BucketName=\"myapp-prd-website\" Environment=\"prd\""
tags = "BACKUP=\"myapp-prd\""
```

`parameter_overrides` in `samconfig.toml` only reaches the **root** template's `Parameters` block — it doesn't automatically reach a nested stack. Getting a value like `BucketName` from `samconfig.toml` down into `infrastructure/cloudfront.yaml` takes three explicit steps:

```yaml
# 1. samconfig.toml (per environment) supplies the value:
#    parameter_overrides = "BucketName=\"myapp-dev-website\" Environment=\"dev\""

# 2. template.yaml (root) — declares the parameter, then explicitly forwards
#    it into the nested stack via that stack resource's own Parameters:
#    property. CloudFormation does NOT auto-propagate parent parameters
#    into nested stacks — this hand-off has to be written out.
Parameters:
  BucketName:
    Type: String

Resources:
  CloudFrontStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: infrastructure/cloudfront.yaml
      Parameters:
        BucketName: !Ref BucketName

# 3. infrastructure/cloudfront.yaml (nested stack) — declares its own
#    Parameters block to receive that forwarded value, then uses it
#    on the actual resource.
Parameters:
  BucketName:
    Type: String

Resources:
  WebsiteBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref BucketName
```

Only once the value lands in the nested stack's own `Parameters` block does `!Ref BucketName` there resolve to `myapp-dev-website`. On first deploy, since that `AWS::S3::Bucket` resource is newly declared with that name, CloudFormation creates it — that's the "auto-create if not there": ordinary resource creation, not a distinct feature. Deploy commands specify which environment feeds this whole chain: `sam deploy --config-env dev` / `sam deploy --config-env prd`.

## Resource naming

Explicit naming is used everywhere — every resource in `template.yaml` and in the `infrastructure/*.yaml` nested stacks gets a named property set (`TableName`, `BucketName`, `RoleName`, etc.), never left to SAM/CloudFormation's auto-generated naming. Flag any resource missing an explicit name as a deviation from convention.

## Tags

A single tag, `BACKUP: <stack name>` — e.g. `BACKUP: myapp-dev`, `BACKUP: myapp-prd` — not a broader set (no cost center/owner tags). Applied stack-wide via the `tags` parameter in `samconfig.toml`'s `deploy.parameters` (see example above). Unlike parameters, this doesn't need the manual root-to-nested-stack forwarding described above — CloudFormation propagates stack-level tags down to nested stacks and their supported resources automatically. Flag a stack missing this tag, or a resource carrying some other ad hoc tag instead.

## Common flags when reviewing

- A resource in `template.yaml` whose `Type` doesn't contain `::Serverless::` and isn't exactly `AWS::CloudFormation::Stack` — the precise check from Structural checks above. That resource likely belongs in `infrastructure/` instead (breaks the nested-stack convention).
- Hardcoded ARNs, account IDs, or region strings instead of pseudo-parameters (`!Ref AWS::AccountId`, `!Ref AWS::Region`) or `Fn::Sub`.
- Missing `DeletionPolicy`/`UpdateReplacePolicy` on stateful resources (DynamoDB tables, S3 buckets) that shouldn't be destroyed on stack changes.
- `Timeout` left at SAM's stock default (3s) instead of the house default of 30s (see Structural checks above) — likely an oversight, not a deliberate choice.
- `MemorySize` left unset without any comment indicating the value was chosen deliberately.
- A nested stack's `TemplateURL` pointing somewhere other than a local `infrastructure/*.yaml` path.
