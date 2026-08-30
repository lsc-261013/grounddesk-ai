# Freelance Service Package

## Service title

**I will build a trustworthy AI customer support system with RAG, citations, and safe business tools**

## Short description

I build production-oriented AI support systems that answer from your approved knowledge, show verifiable citations, refuse unsupported questions, and hand conversations to a human when needed. The implementation can support bilingual content, secure order lookup, deterministic policy checks, a staff dashboard, evaluations, and signed webhooks.

This is not a scripted chatbot or a generic “chat with PDF” wrapper. The system separates model reasoning from business authority: the LLM explains evidence and chooses allowlisted tools, while your server validates permissions, parameters, customer identity, and policy rules.

## Typical deliverables

- Responsive customer chat widget or embedded support page;
- PDF, Markdown, and TXT knowledge ingestion;
- Multilingual embeddings and hybrid vector/keyword retrieval;
- Answers with document, section/page, and excerpt citations;
- Configurable low-confidence refusal and human handoff;
- One or more allowlisted read-only business tools;
- Deterministic policy logic for sensitive decisions;
- Admin and support-agent roles with workspace isolation;
- Conversation, ticket, usage, latency, and quality dashboard;
- Signed webhook events with retry and delivery logs;
- Deterministic evaluation set, smoke tests, and deployment guide;
- Source code and technical handover documentation.

## Suggested engagement scope

### Discovery and data audit

- Confirm supported customer journeys and escalation rules;
- Review knowledge sources, languages, document quality, and update ownership;
- Define what the AI may answer, what a tool may read, and what always requires approval;
- Agree on measurable retrieval, citation, refusal, tool, latency, and security criteria.

### MVP implementation

- Build the ingestion, RAG, generation, tool, ticket, and dashboard flows;
- Add authentication, role permissions, tenant isolation, rate limits, and audit logs;
- Prepare a client-specific evaluation set with deterministic expected outcomes;
- Deploy to agreed managed services and run live-provider acceptance tests.

### Handover

- Environment and deployment documentation;
- Architecture and data-flow diagrams;
- Admin operating guide and known limitations;
- Recorded or live walkthrough of one ingestion, one cited answer, one tool call, one refusal, and one failed evaluation.

## What the client must provide

- Approved knowledge documents and the person responsible for their accuracy;
- Supported languages, markets, products, and policy versions;
- API or sandbox documentation for any order/CRM/helpdesk system;
- Exact identity checks required before customer data is returned;
- Escalation destinations and support operating hours;
- Hosting and model-provider accounts, or approval for the proposed providers;
- Test data that contains no real payment credentials or unnecessary personal data;
- A named reviewer who can approve retrieval and policy results.

## Boundaries

- No direct refunds, payments, order changes, or other irreversible actions in the default scope;
- No scraping or integration with a platform that prohibits the requested access;
- No claim of legal, medical, or financial correctness without domain review;
- No guaranteed model accuracy; acceptance uses an agreed evaluation set and transparent failure reporting;
- Fine-tuning, voice support, mobile apps, multi-agent systems, and custom model hosting are separate projects;
- Third-party hosting, model, embedding, email, and messaging fees are paid by the client;
- Production launch requires the client to approve data retention, privacy, and incident procedures.

## FAQ

### Can you use my existing model provider?

Usually yes. The generation and embedding layers use provider adapters, so a compatible provider can replace DeepSeek or SiliconFlow without rewriting the business workflow. Model capabilities, dimensions, price, and data terms must be revalidated.

### Will the bot answer only from my documents?

For grounded knowledge questions, yes. Evidence thresholds, prompt-injection defenses, and citation validation prevent unsupported free-form answers. When evidence is missing or conflicting, the expected result is refusal and handoff.

### Can it connect to Shopify, a CRM, or our order system?

Yes, when a documented API and a safe sandbox are available. Each operation is implemented as an explicit allowlisted tool with server-side authentication, schema validation, minimum returned fields, audit logs, and an approval boundary for writes.

### How do we measure quality?

We create repeatable cases for expected sources, tool selection, refusal, policy outcomes, security isolation, latency, and errors. An LLM judge may be an additional signal, but it is never the only source of truth.

### Do you need access to production customer data?

Not for initial development. Synthetic or anonymized data is preferred. Production access should be least-privilege, time-limited, logged, and approved by the client.

### What happens after delivery?

The handover explains how to add documents, inspect chunks and citations, run evaluations, rotate secrets, review failed webhooks, and deploy updates. Ongoing monitoring and iteration can be quoted separately.
