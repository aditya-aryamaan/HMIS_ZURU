# Demonstrated workflow exports

Import these two inactive exports into n8n:

- `01-hiring-pack-generator.json` — adaptive hiring-manager interview, employment-type rules, Hiring Brief Readiness, PDF hiring pack, and evaluator routing.
- `02-candidate-evaluator.json` — post-interview evidence review against the generated `role-rubric.json`.

The Telegram workflow sends the job description PDF, hiring guide PDF, and internal rubric handoff. The evaluator returns a candidate evidence review PDF and leaves the hiring decision to the human panel.

Connect OpenRouter and Telegram credentials through n8n after import. Replace the approved Telegram user ID and evaluator form URL placeholders in the routing node. Never add secrets to exported workflow JSON.

PDF nodes call `http://gotenberg:3000` on the private Docker network. Start the Docker project before generating documents.
