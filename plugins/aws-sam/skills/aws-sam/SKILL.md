---
name: aws-sam
description: Guidance for scaffolding, writing, and reviewing AWS Serverless Application Model (SAM) projects using Jonathan's Node.js/TypeScript coding standards and file conventions. Covers three workflows — scaffolding new SAM projects (folder structure, template.yaml, boilerplate), writing/reviewing Lambda function code in TypeScript, and validating template.yaml files against house conventions. Use this skill whenever the user mentions AWS SAM, `sam build`/`sam deploy`/`sam local`, `template.yaml`, SAM CLI, or serverless Lambda projects — even if they don't say "SAM" explicitly, e.g. "set up a new Lambda project," "does my template.yaml look right," or "review this handler function."
---

# AWS SAM Development

Guidance for scaffolding, writing, and reviewing AWS Serverless Application Model (SAM) projects.

## Reference files

| Task | Reference file |
|---|---|
| Scaffolding a new SAM project, or adding a new function to an existing one | `references/scaffolding.md` |
| Writing or reviewing a Lambda handler in TypeScript | `references/lambda-standards.md` |
| Reviewing or editing `template.yaml` | `references/template-review.md` |

Load only the reference file(s) relevant to the current request. A single request — "add a new endpoint," for example — often touches more than one.

## Workflow

1. Identify which reference file(s) the request touches.
2. Read them.
3. Apply the conventions described there. Where a section is still marked `PLACEHOLDER:`, use the general AWS SAM best practice given as the default, and flag which specific decision was a default rather than an established convention.
4. A real example already supplied by the user always overrides a placeholder default.

