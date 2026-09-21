# Automated tests

These tests validate the two demonstrated workflow exports and their deterministic business rules. They are not required to run the n8n workflows, but they provide repeatable evidence that the exported POC still satisfies its structural and safety controls.

The suites cover:

- Vague Marketing Intern request
- Over-specified entry-level role
- Culture-focused manager response
- Technical AI Integration Intern role
- Creative Brand Designer role
- Strong, mixed, and insufficient candidate evidence

Run both suites from the repository root:

```bash
node --test tests/workflow-validation.test.mjs tests/hiring-readiness.test.mjs
```
