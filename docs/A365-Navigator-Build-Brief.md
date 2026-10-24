# Agent 365 Navigator: build brief for GitHub Copilot (Agent mode) · v2

> Save this file in your repo as `docs/A365-Navigator-Build-Brief.md`. Then ask Copilot (Agent mode) to read it, or paste it straight into chat. Build in phases (§15) and stop for review after each one. The site is hosted on **GitHub Pages** (§12). What changed since v1 is listed at the end of this brief.

---

## 1. Mission and north star

You are a principal product engineer and design-systems lead who has built client-facing digital tools for top-tier strategy and Big Four consulting firms. Build **Agent 365 Navigator**, a production-quality static web app hosted on GitHub Pages. It helps Microsoft field teams, partners and customers (executives, architects, agent builders, and security and compliance admins) understand Microsoft Agent 365 and design agent use cases with the right controls.

**North star.** Within 10 minutes, anyone designing an agent can answer these questions for their use case:
1. **What** does Agent 365 offer today, according to the official service description?
2. **Which** capabilities apply to this agent, and **why**? Every mapping shows the evidence behind it.
3. **Where** does each capability act on the agent? The layers are registry, identity, tools, data, network, device and oversight.
4. **Who** owns each capability, and **when** in the agent's lifecycle does it matter?
5. **What's already in place** in their environment, **what's missing**, and what does that mean for licensing and rollout?
6. **What would change** the answer? For example: moving to production, adding sensitive data, going autonomous, adding new tools or moving to GCC.

**Three experiences**
- **Understand:**
  - a Capability Explorer that lets people view the capabilities through several lenses
  - a one-page brief for each capability
  - a Learn hub
  - a pattern library that shows how the capabilities fit common types of agent
- **Assess:** a Use Case Diagnostic that maps a specific use case, plus the organization's environment, to Agent 365 capabilities.
- **Present:**
  - board-ready readouts
  - a one-page Use Case Canvas
  - a portfolio view
  - a workshop kit

  All of these use an executive-consulting look framed by Microsoft's Frontier Firm model.

## 2. Non-negotiable principles

1. **Content is data.** No capability, question, rule, pattern, risk, source, licensing note or marketing copy is hard-coded in a component. All of it lives in `/content/*.yaml` and is validated against schemas at build time.
   - Adding a capability means editing YAML only.
   - The new capability then flows automatically into every lens, KPI, matrix, search result, pattern and readout.
2. **Numbers are computed, never typed.** Every count, KPI and number in a headline is computed from the content at render time, using templates.
3. **Source fidelity.**
   - Each capability stores the verbatim feature text from the service description, its source ID and a `lastVerified` date.
   - Editorial content is labeled editorial and carries `reviewStatus: draft | reviewed`. Draft content shows a "Pending SME review" marker.
   - Never invent capabilities, licensing statements, statuses or URLs. If you don't know a value, leave the field empty and add `# TODO(verify)`.
4. **Every mapping shows its evidence.** Each recommendation carries an evidence tag. Show the tag and its source wherever a recommendation appears.
   - **Stated:** an official source says it directly.
   - **Inferred:** it follows from the capability's official description.
   - **Advisor judgment:** it's consulting judgment and needs SME review.
5. **Show the whole picture.** Show:
   - what's in scope
   - what isn't in scope, and what would bring each item into scope
   - what would change the answer
6. **Two depths of language.** Add a global **Executive | Technical** view toggle.
   - **Executive** shows outcomes in plain language.
   - **Technical** adds consoles, configuration notes, dependencies and evidence details.
7. **Recommendation levels are Essential, Recommended and Consider.** Never call a level "Required." That keeps recommendations from being confused with the service description's licensing column ("Requires Microsoft 365 E7 / G7 or Agent 365"). The Methodology page defines each level.
8. **Private by design.**
   - Everything runs client-side. There's no backend, no cookies, no analytics and no third-party calls at runtime. Fonts are self-hosted.
   - Answers live only in the browser's `localStorage`. Users can export and import JSON.
   - Share links keep their state in the URL fragment (`#s=…`, compressed with `lz-string`), which browsers never send to a server.
   - The Privacy page must say honestly that GitHub Pages logs visitor IP addresses for security purposes (see §12).
9. **Executive-grade craft.**
   - Visual design and writing at consulting-firm quality (§10).
   - WCAG 2.2 AA accessibility.
   - Fast load times and clean print output.
10. **Honest disclaimers.** The footer and every readout say: "Guidance tool for planning conversations. Not an official Microsoft licensing determination. Confirm with the Microsoft Agent 365 service description, the Microsoft Product Terms and your Microsoft account team."

## 3. Sources of truth (verified)

Store these in `content/sources.yaml` with the fields `id, title, url, publisher, lastVerified, notes`.

| id | Title | URL |
|---|---|---|
| `sd-a365` | Microsoft Agent 365: Service Descriptions (**primary source**, last updated 10/01/2026) | https://learn.microsoft.com/en-us/office365/servicedescriptions/microsoft-agent-365/microsoft-agent-365 |
| `a365-overview` | Microsoft Agent 365 overview | https://learn.microsoft.com/en-us/microsoft-agent-365/overview |
| `a365-docs` | Microsoft Agent 365 documentation | https://learn.microsoft.com/en-us/microsoft-agent-365/ |
| `a365-dev` | Microsoft Agent 365 SDK and CLI | https://learn.microsoft.com/en-us/microsoft-agent-365/developer/ |
| `a365-sdk` | Microsoft Agent 365 SDK overview | https://learn.microsoft.com/en-us/microsoft-agent-365/developer/agent-365-sdk |
| `a365-quickstart` | Quickstart: Connect an existing agent to Agent 365 | https://learn.microsoft.com/en-us/microsoft-agent-365/developer/get-started |
| `a365-registry` | Agent Registry in Microsoft 365 admin center | https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-registry-overview |
| `a365-agent-map` | Use Agent Map in the Microsoft 365 admin center | https://learn.microsoft.com/en-us/microsoft-365/admin/manage/agent-map?view=o365-worldwide |
| `a365-cps-registry` | Agent registry integration for Copilot Studio | https://learn.microsoft.com/en-us/microsoft-agent-365/builder/agent-registry |
| `a365-admin-overview` | Agent management in Microsoft 365 admin center | https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-365-overview |
| `lic-faq` | Microsoft Licensing FAQs: Microsoft Agent 365 | https://www.microsoft.com/licensing/faqs/122 |
| `wti-2025` | 2025 Work Trend Index: The year the Frontier Firm is born | https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born |
| `gh-pages-visibility` | GitHub Docs: Changing the visibility of your GitHub Pages site | https://docs.github.com/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site |
| `gh-pages-workflows` | GitHub Docs: Using custom workflows with GitHub Pages | https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages |

The service description is the **primary** source for the capability list and its availability columns. If you have a web-fetch tool (for example `#fetch`), fetch `sd-a365` first and confirm the table in §4.1 still matches. Report any differences before you write content. Otherwise, treat §4.1 as authoritative.

## 4. Capability catalog → `content/capabilities.yaml`

### 4.1 Service description rows (verbatim)

The service description's feature table has these columns: *Features · Management Console · Included with Microsoft 365 Enterprise, Business, Education, and Front Line Worker plans · Requires Microsoft 365 E7 / G7 or Agent 365 · GCC Availability*. Seed all 26 rows exactly as written below.

| # | id | Short name (editorial) | Feature (verbatim from the service description) | Console | Included with M365 Ent/Bus/Edu/FLW | E7/G7 or A365 | GCC | Pillar (editorial) | Default wave (editorial) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `registry-inventory` | Agent Registry inventory | Inventory of agents across the organization in the Agent Registry | Microsoft 365 admin center | Yes | Yes | Yes | Observe | 1 |
| 2 | `governance-actions` | Core governance actions | Basic governance actions on agents (publish, deploy, block, delete, approve; assign agents to specific user/groups; reassign agent owner, pin, etc.) | Microsoft 365 admin center | Yes | Yes | Yes | Govern | 1 |
| 3 | `lifecycle-automation` | Rules-based lifecycle automation | Automate agent lifecycle actions using conditions-based rules | Microsoft 365 admin center | Yes | Yes | Yes | Govern | 2 |
| 4 | `registry-sync` | External registry sync | Synchronize agents and agent metadata from external platforms that aren't managed by Agent 365 into the registry | Microsoft 365 admin center | Yes | Yes | Yes | Observe | 1 |
| 5 | `policy-templates` | Agent policy templates | Policy templates applying customized policies and controls to agents | Microsoft 365 admin center | No | Yes | Yes | Govern | 2 |
| 6 | `observability` | Agent observability & monitoring | Observability and monitoring of agent activity (Visualization and telemetry) | Microsoft 365 admin center | No | Yes | Yes | Observe | 1 |
| 7 | `tool-controls` | Tenant-wide tool & MCP controls | Control which tools (including Microsoft MCP servers) agents can access tenant-wide | Microsoft 365 admin center | No | Yes | Yes | Govern | 2 |
| 8 | `registry-graph-api` | Agent Registry Graph API | Graph API provides access to agent registry, basic metadata, and governance actions | N/A | No | Yes | No | Govern | 3 |
| 9 | `entra-access-packages` | Access packages for agents | Access packages for agents to define scope of agent permissions | Entra | No | Yes | Yes | Govern | 2 |
| 10 | `entra-sponsor-lifecycle` | Sponsor-driven lifecycle policies | Built-in Entra lifecycle policies automate sponsor-driven workflows to maintain accountability | Entra | No | Yes | Yes | Govern | 1 |
| 11 | `entra-conditional-access` | Conditional Access & Identity Protection | Conditional access and identity protection for agents (for agents with delegated access - extend user policies to agents) | Entra | No | Yes | Yes | Secure | 2 |
| 12 | `entra-network-controls` | Network controls for agents | Monitor and block malicious and noncompliant network traffic for agents, operating on user devices, and for Copilot Studio agents | Entra | No | Yes | No | Secure | 2 |
| 13 | `purview-audit-ediscovery` | Audit & eDiscovery | Audit logs of agent activities and eDiscovery (content search) of agent interaction to export and hold for legal, regulatory, and investigative needs | Purview | No | Yes | No | Govern | 3 |
| 14 | `purview-dlm` | Data Lifecycle Management | Data Lifecycle Management for agent-generated data and interactions in line with regulations and org policies | Purview | No | Yes | No | Govern | 3 |
| 15 | `purview-ai-compliance` | Interaction compliance & Compliance Manager | Detect and review noncompliant agent interactions; extend compliance manager to agents to assess, manage, and demonstrate AI compliance | Purview | No | Yes | No | Govern | 3 |
| 16 | `purview-dspm-ai` | DSPM with AI Observability | Data Security Posture Management with AI Observability provides deep interaction visibility for agents | Purview | No | Yes | No | Secure | 3 |
| 17 | `purview-insider-risk` | Insider Risk Management for agents | Extend Insider Risk Management to agents – detect anomalous and risky agent activities | Purview | No | Yes | No | Secure | 3 |
| 18 | `purview-labels` | Sensitivity label inheritance | Agents inherit and honor data sensitivity labels | Purview | No | Yes | No | Secure | 2 |
| 19 | `purview-dlp` | Data loss prevention for agents | Data loss prevention – block agents from accessing and sharing sensitive content | Purview | No | Yes | No | Secure | 2 |
| 20 | `defender-shadow-ai` | Shadow AI endpoint agent sync | Sync shadow AI endpoint agents | Defender | No | Yes | No | Observe | 1 |
| 21 | `defender-posture` | Agent posture & exposure management | Identify and remediate agent misconfigurations and exposure risks, relationship mapping for local agents (agent to devices, MCPs, etc.) | Defender | No | Yes | No | Secure | 3 |
| 22 | `defender-threat-protection` | Threat detection & tool-call blocking | Detect suspicious agent activity, receive alerts, and allow blocking for tool invocations for agents | Defender | No | Yes | No | Secure | 3 |
| 23 | `defender-hunting` | Threat hunting & investigation | Collect Agent 365 unified agent observability logs and allow investigation and hunting for threats for agents | Defender | No | Yes | Yes | Secure | 3 |
| 24 | `intune-device-compliance` | Device compliance for agent CA | Device compliance for agent conditional access | Intune | No | Yes | Yes | Secure | 2 |
| 25 | `intune-runtime-policy` | Policy-controlled agent runtime | Policy-controlled environment for agents runtime | Intune | No | Yes | No | Secure | 3 |
| 26 | `intune-block-local` | Block unsanctioned local agents | Block unsanctioned local endpoint agents | Intune | No | Yes | No | Secure | 2 |

**Derived fields and seed KPIs.** These double as unit-test assertions.
- `licensingTier` is `foundational` when the "Included with … plans" column is Yes. Otherwise it's `premium`, labeled "Requires Microsoft 365 E7/G7 or Agent 365".
- Show the console value `N/A` as "Programmatic (Graph API)".
- Expected counts:
  - 26 capabilities in total: 4 foundational and 22 premium.
  - 12 available in GCC.
  - By console: Microsoft 365 admin center 7, Purview 7, Entra 4, Defender 4, Intune 3, N/A 1.
  - By pillar: Secure 12, Govern 10, Observe 4.

### 4.2 Fit metadata (editorial, `reviewStatus: draft`)

| id | Where it acts (control point) | Setup | Lifecycle stages |
|---|---|---|---|
| `registry-inventory` | Registry, lifecycle & policy (`registry`) | platform | Build, Operate |
| `governance-actions` | Registry, lifecycle & policy (`registry`) | agent | Deploy, Operate, Retire |
| `lifecycle-automation` | Registry, lifecycle & policy (`registry`) | platform | Operate, Retire |
| `registry-sync` | Registry, lifecycle & policy (`registry`) | platform | Build, Operate |
| `policy-templates` | Registry, lifecycle & policy (`registry`) | both | Deploy |
| `observability` | Monitoring, compliance & response (`oversight`) | platform | Operate |
| `tool-controls` | Tools & actions (`tools`) | both | Deploy, Operate |
| `registry-graph-api` | Registry, lifecycle & policy (`registry`) | platform | Operate |
| `entra-access-packages` | Identity & access (`identity`) | agent | Build, Deploy |
| `entra-sponsor-lifecycle` | Identity & access (`identity`) | both | Build, Operate, Retire |
| `entra-conditional-access` | Identity & access (`identity`) | platform | Operate |
| `entra-network-controls` | Network (`network`) | platform | Operate |
| `purview-audit-ediscovery` | Monitoring, compliance & response (`oversight`) | platform | Operate, Respond |
| `purview-dlm` | Data & knowledge (`data`) | platform | Operate, Retire |
| `purview-ai-compliance` | Monitoring, compliance & response (`oversight`) | platform | Operate, Respond |
| `purview-dspm-ai` | Data & knowledge (`data`) | platform | Plan, Operate |
| `purview-insider-risk` | Monitoring, compliance & response (`oversight`) | platform | Operate, Respond |
| `purview-labels` | Data & knowledge (`data`) | platform | Plan, Operate |
| `purview-dlp` | Data & knowledge (`data`) | platform | Deploy, Operate |
| `defender-shadow-ai` | Devices & runtime (`endpoint`) | platform | Operate |
| `defender-posture` | Monitoring, compliance & response (`oversight`) | platform | Operate |
| `defender-threat-protection` | Tools & actions (`tools`) | platform | Operate, Respond |
| `defender-hunting` | Monitoring, compliance & response (`oversight`) | platform | Respond |
| `intune-device-compliance` | Identity & access (`identity`) | platform | Operate |
| `intune-runtime-policy` | Devices & runtime (`endpoint`) | platform | Operate |
| `intune-block-local` | Devices & runtime (`endpoint`) | platform | Operate |

- **Owner team** comes from the console, via `consoles.yaml` (each capability can override it):

  | Console | Owner team |
  |---|---|
  | Microsoft 365 admin center | AI & Microsoft 365 admin team |
  | Entra | Identity team |
  | Purview | Data security & compliance team |
  | Defender | Security operations |
  | Intune | Endpoint management team |
  | N/A (Graph API) | AI & Microsoft 365 admin team, with integration owners |

- **Setup** tells people who acts:
  - `platform`: central teams enable it once, and every agent inherits it.
  - `agent`: it needs a decision for each agent.
  - `both`: a central policy plus per-agent decisions.
- **Seed counts:**
  - Setup: platform 21, both 3, agent 2.
  - Control points: registry 6, oversight 6, identity 4, data 4, endpoint 3, tools 2, network 1.
- The Overview generates this headline insight from the data: "Most of Agent 365 is a platform foundation you set up once; only a few decisions are made per agent."

### 4.3 Sources differ: show both, don't hide

The licensing FAQ (`lic-faq`) classifies some capabilities differently from the service description. Seed these as `sourceNotes`. Show a "Sources differ, verify" badge with both statements side by side:

| Capability | Service description says | Licensing FAQ says |
|---|---|---|
| `lifecycle-automation` | Included with base plans | Lists "Automate agent lifecycle actions" as requiring an Agent 365 license |
| `registry-sync` | Included with base plans | Lists "Registry sync" as requiring an Agent 365 license |
| `purview-audit-ediscovery` | Requires E7/G7 or Agent 365 | Lists "Audit logs and eDiscovery for agent activity" under **both** included and licensed capabilities |
| `intune-block-local` | Requires E7/G7 or Agent 365 | Lists "Block unsanctioned local endpoint agents" as included |
| `defender-shadow-ai` | Requires E7/G7 or Agent 365 | Lists "Discovery of AI on endpoints" as included. This may be a different capability, so flag it for SME review. |

### 4.4 Status

- Leave `status` empty unless a source states it.
- Only show a badge for preview or Frontier preview.
- The Agent Registry docs (`a365-registry`) label the Graph API for the Agent Registry as preview, so seed `registry-graph-api` with `status: preview`.

### 4.5 Schema (Zod + inferred TypeScript types)

```ts
type Pillar = 'observe' | 'govern' | 'secure';
type Level = 'essential' | 'recommended' | 'consider';
type Evidence = 'stated' | 'inferred' | 'judgment';
type ControlPoint = 'registry' | 'identity' | 'tools' | 'data' | 'network' | 'endpoint' | 'oversight';
type Stage = 'plan' | 'build' | 'deploy' | 'operate' | 'respond' | 'retire';

interface Capability {
  id: string;                               // kebab-case; stable forever (URLs, rules, saved assessments)
  shortName: string;                        // editorial
  source: {
    sourceId: 'sd-a365';
    featureText: string;                    // VERBATIM
    console: 'Microsoft 365 admin center' | 'Entra' | 'Purview' | 'Defender' | 'Intune' | 'N/A';
    includedWithBasePlans: boolean;
    availableWithE7G7OrA365: boolean;
    gccAvailable: boolean;
    lastVerified: string;                   // ISO date
  };
  pillar: Pillar;                           // editorial
  defaultWave: 1 | 2 | 3;                   // editorial
  controlPoints: ControlPoint[];            // editorial; first = primary
  setup: 'platform' | 'agent' | 'both';     // editorial
  lifecycleStages: Stage[];                 // editorial
  ownerTeam?: string;                       // overrides the console default
  summary?: string;                         // what it is, ≤ 40 words
  executiveValue?: string;                  // why a CIO/CISO cares, ≤ 30 words
  withoutIt?: string;                       // the risk scenario, ≤ 30 words
  withIt?: string;                          // the controlled outcome, ≤ 30 words
  questionsItAnswers?: string[];            // intent search, e.g. "How do I stop agents sharing sensitive files?"
  discoveryQuestions?: string[];            // for workshops and seller conversations
  prerequisites?: { when: Condition; gap: string; evidence: Evidence; sourceId?: string }[]; // evaluated against the org profile
  dependencies?: { note: string; sourceId: string }[];
  sourceNotes?: { sourceId: string; note: string }[];
  docs?: { title: string; url: string }[];  // verified URLs only
  status?: 'ga' | 'preview' | 'frontier-preview';
  reviewStatus: 'draft' | 'reviewed';
  tags?: string[];
}
```

Draft the editorial text fields for all 26 capabilities in a neutral, factual voice, with `reviewStatus: draft`. Don't make any claim that goes beyond the feature text and the sources in §3.

## 5. Comprehension content

### 5.1 Control points (the "agent anatomy") → `content/control-points.yaml`

| id | Layer | What it governs |
|---|---|---|
| `registry` | Registry, lifecycle & policy | Who the agent is, who owns it, which policies apply, and how it's published, changed and retired |
| `identity` | Identity & access | How the agent authenticates and what it's allowed to reach |
| `tools` | Tools & actions | Which tools and MCP servers it can call, and what happens when a call looks risky |
| `data` | Data & knowledge | What it can see, keep and share |
| `network` | Network | Where its traffic can go |
| `endpoint` | Devices & runtime | Where it runs, and which local agents are allowed |
| `oversight` | Monitoring, compliance & response | How you watch it, prove compliance and investigate |

### 5.2 Lifecycle stages → `content/lifecycle.yaml`

| id | Stage |
|---|---|
| `plan` | Plan & design |
| `build` | Build & register |
| `deploy` | Publish & deploy |
| `operate` | Operate & monitor |
| `respond` | Investigate & respond |
| `retire` | Retire |

### 5.3 Pattern library → `content/patterns.yaml`

Patterns are common types of agent, each defined as a canonical set of diagnostic answers.
- The **Pattern × Capability matrix is generated by running the rule engine on each pattern**, using a neutral organization profile. Never hand-maintain this matrix; generating it keeps it consistent with the rules.
- Draft the canonical answers with `reviewStatus: draft`.
- The Frontier Firm phase is derived from `accessModel`.

| id | Pattern | What it is | Signature answers |
|---|---|---|---|
| `personal-assistant` | Personal productivity assistant | Helps one person with their own work, acting as them | Agent Builder · delegated · suggests only · reads and drafts Microsoft 365 content · user prompt |
| `knowledge-agent` | Knowledge & helpdesk agent | Answers questions from approved knowledge (policies, SOPs) for a team or workforce | Copilot Studio · delegated · suggests only · Microsoft 365 content · Teams/Copilot · employees and frontline |
| `process-agent` | Process automation agent | Runs a business process behind the scenes (for example, triaging tickets) with its own identity | Microsoft Foundry · own access (background) · autonomous · events/schedule · updates records · connectors/APIs · confidential data |
| `ai-teammate` | AI teammate | Joins a team as a digital colleague with its own account (mailbox, Teams presence) | Pro-code with the Agent 365 SDK teammate path · own access (teammate) · approval-gated · Teams/Outlook · creates content · Microsoft MCP tools |
| `customer-agent` | Customer- or partner-facing agent | Serves people outside the organization | Copilot Studio · own access (background) · customers/partners · personal data · communicates externally · web channel |
| `multi-agent` | Multi-agent orchestrator | Coordinates other agents and tools to complete a workflow | Pro-code (third-party SDK) · own access · autonomous · agent-to-agent · MCP servers and code execution |
| `external-platform-agent` | Agent on an external platform | Built and run on Amazon Bedrock, Google Vertex AI or a SaaS platform, and governed alongside Microsoft agents | Bedrock/Vertex · own access · updates records · events |
| `local-agent` | Local agent on endpoints | Runs on employees' devices (for example, coding or CLI agents) | Local agent · delegated · code execution, web browsing, third-party MCP · network egress · source code (trade secrets) |
| `computer-use-agent` | Computer-use agent | Operates a desktop or browser to complete tasks in apps that have no APIs | Microsoft Foundry · own access · computer use and web browsing · approval-gated |

### 5.4 Risk lens → `content/risks.yaml`

The risk-to-capability mapping is advisor judgment and needs SME review. Each risk has a `triggeredWhen` condition (written in the §6.4 condition format) and a `mitigatedBy` list.

| id | Risk | Typically triggered when | Mitigated by |
|---|---|---|---|
| `agent-sprawl` | Agent sprawl and ownerless agents | Dozens or more agents; agents shared by individual creators; no named sponsor | `registry-inventory`, `registry-sync`, `lifecycle-automation`, `entra-sponsor-lifecycle`, `governance-actions` |
| `over-permissioned` | Over-permissioned agents | Own access; updates records, executes transactions or changes configurations | `entra-access-packages`, `tool-controls`, `policy-templates` |
| `identity-misuse` | Risky sign-ins and misuse of delegated access | Delegated or mixed access | `entra-conditional-access`, `intune-device-compliance` |
| `data-leakage` | Sensitive-data oversharing and leakage | Confidential or regulated data; communicates externally | `purview-labels`, `purview-dlp`, `purview-dspm-ai` |
| `unsafe-tools` | Unsafe tool and MCP use | Any tools, MCP servers, code execution or computer use | `tool-controls`, `defender-threat-protection`, `defender-posture` |
| `network-threats` | Malicious or noncompliant network traffic | Network egress; web browsing; Copilot Studio or local agents | `entra-network-controls` |
| `shadow-ai` | Unsanctioned local agents (shadow AI) | Local agents; shadow AI concern in the organization profile | `defender-shadow-ai`, `intune-block-local`, `intune-runtime-policy`, `defender-posture` |
| `compliance-exposure` | Compliance and legal exposure | Legal hold, retention, regulator audits or AI regulation; regulated data | `purview-audit-ediscovery`, `purview-dlm`, `purview-ai-compliance` |
| `anomalous-behavior` | Anomalous or malicious agent behavior | Autonomous agents; SOC or insider-risk programs | `defender-threat-protection`, `defender-hunting`, `purview-insider-risk` |
| `blind-spots` | No visibility into usage, value or health | Pilot or later; executive reporting; agent-to-agent | `observability`, `registry-inventory`, `registry-graph-api` |

Validation must fail the build unless every capability has at least one control point, at least one lifecycle stage and at least one risk.

### 5.5 Learn hub content

- **Concepts in 5 minutes.** A step-through "request flow" diagram. It's conceptual and editorial; if you can fetch it, align it with the "How a request flows" section of `a365-sdk`. Each step highlights the capabilities that act there:
  1. A person or event triggers the agent in a channel.
  2. **Identity:**
     - With delegated access, the user's Conditional Access policies extend to the agent.
     - With its own access, the agent's identity is scoped by access packages.
  3. **Registry status and policy** apply.
  4. **Tool controls** decide which tools the agent can call, and Defender can block risky tool calls.
  5. **Data:** sensitivity labels are honored and DLP applies.
  6. **Network and device controls** apply.
  7. **Oversight:**
     - telemetry
     - audit
     - compliance
     - insider risk
     - threat detection and hunting
- **Building blocks** (`content/building-blocks.yaml`). Related concepts that are *not* line items in the service description. Label them clearly as such:
  - agent identity (Microsoft Entra)
  - agent blueprint
  - the four Agent Registry agent types: Microsoft, external partner-built, published by your org, and shared by creator
  - Agent Map, with its summary cards: total agents, agents at risk, agents without owners, unmanaged agents
  - Agent 365 SDK
  - Agent 365 CLI
  - Microsoft 365 Agents SDK
  - Microsoft OpenTelemetry
  - Work IQ tools
  - MCP servers
  - Windows 365 for Agents
  - Frontier program
- **Glossary** (`content/glossary.yaml`). The first use of each term on a page links to it automatically and shows a tooltip.
- **Myths vs. facts** (`content/faq.yaml`). Paraphrase rather than copying long passages, and give each item a `sourceId`.

  | # | Myth | Fact | Source |
  |---|---|---|---|
  | 1 | "Microsoft 365 Copilot already governs our agents." | Agent 365 is needed *in addition to* Microsoft 365 Copilot to manage, govern and secure all agents. | `lic-faq` |
  | 2 | "Every agent needs its own license." | Agents aren't licensed. Agent 365 is licensed per user: the user, owner, sponsor or manager associated with the agent. | `lic-faq` |
  | 3 | "Blueprints and agent instances count as licenses." | They aren't licensed separately. | `lic-faq` |
  | 4 | "Securing Foundry agents costs more than securing Copilot Studio agents." | Agent 365 doesn't differentiate by build platform. | `lic-faq` |
  | 5 | "One sponsor can only oversee a few agents." | The licensing model sets no fixed cap. Service limits may apply. | `lic-faq` |
  | 6 | "Agent 365 replaces Microsoft 365 E5." | They're complementary: E5 protects users, Agent 365 protects agents, and E7 covers both. | `lic-faq` |
  | 7 | "You need Microsoft 365 E7 to get Agent 365." | It's also available standalone, and E7 includes it. | `lic-faq`, `sd-a365` |
  | 8 | "DSPM for AI needs Agent 365." | DSPM and AI Observability work without it. Agent-specific insights need Agent 365 or E7. | `lic-faq` |
  | 9 | "The Agent 365 SDK is for building agents." | It extends an existing agent with identity, tooling and notifications. The Microsoft 365 Agents SDK builds conversational agents, and the two work together. | `a365-sdk` |
  | 10 | "Registering an agent turns on monitoring." | Registration gives catalog visibility. Telemetry comes from instrumenting observability. | `a365-quickstart` |
  | 11 | "Windows 365 for Agents is included." | It's a separate, usage-based offer. | `lic-faq` |

- **Where Agent 365 fits.** Source: `lic-faq`.
  - Microsoft 365 Copilot is about what AI can do. Agent 365 is about controlling what AI is allowed to do.
  - Microsoft 365 E5 protects users, Agent 365 protects agents, and E7 protects both.
  - E7 includes Microsoft 365 E5, Agent 365, Microsoft 365 Copilot and Entra Suite.

### 5.6 Personas and entry paths → `content/personas.yaml`

| Persona | What they need | Start path |
|---|---|---|
| Executive (CIO, CISO, business leader) | Value, risk and investment in plain language | Overview → Where Agent 365 fits → Pattern matrix → Portfolio |
| Architect | Where controls act and how agents integrate | Layer lens → Patterns → Integration paths → Diagnostic |
| Agent builder / developer | What to add to the agent, and in what order | Integration paths & builder checklist → Quick scan → Readout (Technical view) |
| Security & compliance admin | What to configure, where, and the prerequisites | Console lens → Capability briefs → Readiness |
| Microsoft seller / partner | How to run the conversation | Myths vs. facts → Pattern cards → Diagnostic with the customer → Readout & workshop kit |

### 5.7 Other content files

| File | Contents |
|---|---|
| `site.yaml` | Product name, tagline ("Built for the Frontier Firm"), all UI copy, readout sentence templates with placeholders (for example `{essentialCount}`), `repoUrl`, `feedbackEmail` and the disclaimer. |
| `pillars.yaml` | Observe, Govern and Secure, with definitions paraphrased from `a365-overview` in 25 words or fewer. |
| `consoles.yaml` | The six consoles, with display names, owner teams and display order. |
| `frontier-phases.yaml` | The Frontier Firm journey (`wti-2025`) and an editorial mapping to access models, described after this table. |
| `integration-paths.yaml` | Each path has a builder checklist taken from the sources; the paths are described after this table. |
| `licensing.yaml` | From `lic-faq`. Never show prices in the UI; link to official pages instead. Contents are described after this table. |
| `samples.yaml` | Five illustrative retail and consumer-goods examples, each linked to a pattern, described after this table. |
| `what-ifs.yaml` | `to-production`, `add-confidential-data`, `go-autonomous` (`own-background` + `autonomous`), `add-mcp-tools`, `open-to-customers`, `move-to-gcc` (organization profile). |
| `golden-scenarios.yaml` | One scenario per pattern and per sample. Each has `mustInclude` (essential capabilities), `mustNotInclude`, `reviewedBy` and `reviewedOn`. |
| `workshop.yaml` | The facilitator agenda for a 90-minute "Agent use case & controls" session. |
| `changelog.md` | Each entry lists `affects: [capabilityIds]`. |

**`frontier-phases.yaml`**

The mapping between phases and access models is editorial.
- **Phase 1, Human with assistant:** AI assistants help each employee work better and faster. Maps to **delegated access**.
- **Phase 2, Human-agent teams:** agents join teams as "digital colleagues" and take on specific tasks at human direction. Maps to **own access in team workflows** (AI teammates, which need the Frontier preview program per `a365-quickstart`).
- **Phase 3, Human-led, agent-operated:** humans set direction while agents run business processes and check in as needed. Maps to **own access behind the scenes**.
- Note that the journey isn't strictly linear.
- Include a short glossary: agent boss, human-agent ratio, digital labor, intelligence resources.

**`integration-paths.yaml`**

Each path has a builder checklist taken from the sources.

- **`native`** (for example, Copilot Studio):
  - The agent appears in the registry when it's created, with an Entra identity provisioned.
  - Metadata changes sync automatically.
  - Permission changes trigger a DLP re-evaluation.
  - Deleting the agent removes its registry entry and identity, while historical telemetry is retained (`a365-cps-registry`).
- **`agent365-sdk`** (agents built with any SDK or framework, hosted on any cloud): checklist from `a365-quickstart`.
  - **Steps:**
    1. Register the agent: an Entra blueprint, then an agent identity, then permissions (delegated for OBO, application for S2S).
    2. Instrument observability with Microsoft OpenTelemetry.
    3. Connect Microsoft 365 data.
    4. Add DLP.
    5. Test.
    6. Validate.
  - **Prerequisites:**
    - Python, Node.js or .NET
    - a tenant with Agent 365 enabled
    - Global Administrator or Agent ID Developer
    - an Azure subscription
    - a supported coding assistant
  - Say plainly that the Agent 365 SDK and the Microsoft 365 Agents SDK are different products that work together.
- **`ai-teammate`:**
  - Adds messaging and notifications.
  - The agent gets its own user account, with a mailbox and Teams presence.
  - Frontier preview only.
- **`registry-sync`:** for connected platforms such as Amazon Bedrock and Google Vertex AI. Configure sync per platform; the available controls depend on the provider. `status: verify`.
- **`endpoint`:** local agents on Windows devices are discovered and controlled through Defender and Intune. `status: verify`.

**`licensing.yaml`**

Never show prices in the UI; link to official pages instead. Include:
- Agent 365 is licensed per user (E7 or standalone), and agents aren't licensed.
- Who must be licensed:
  - users who delegate access to agents
  - the owner, sponsor or manager of agents with their own access
- What's foundational and what's premium.
- Prerequisites by segment:
  - **Enterprise:** Microsoft 365 E5, or Microsoft 365 E3 (or Office 365 E3 + EMS E3) plus both Defender Suite and Purview Suite.
  - **Frontline:** F1/F3 plus Defender and Purview Suite FLW.
  - **SMB:** Business Premium. The SMB suites are needed to unlock functionality but aren't formal prerequisites.
  - **Education:** A5, or A3 plus the Education suites.
- Only users who meet the prerequisites are eligible.
- Signed contracts aren't affected until renewal.
- What's limited without Microsoft 365 E5.
- E7 isn't affected by the prerequisites.
- Sizing reports: "Active users using agents in Microsoft 365 Copilot" and "Registry agent owners". Use the two together.
- Observability signals appear once the first license is assigned.
- Windows 365 for Agents is a separate offer.

**`samples.yaml`**

Five illustrative retail and consumer-goods examples, each linked to a pattern:
1. Store Operations Assistant (`knowledge-agent`).
2. Returns & Refunds Resolution Agent (`process-agent`).
3. Category Demand-Planning Analyst on Amazon Bedrock (`external-platform-agent`).
4. AskHR Agent (`process-agent`).
5. Developer coding agents (`local-agent`).

## 6. Use Case Diagnostic

### 6.1 Experience

- **Organization profile first.** It's filled in once per organization or engagement, and every use case then reuses it. Each reason in a readout says whether it came from the **organization profile** or the **use case**.
- **Starting point:** a pattern, a sample, or a blank assessment.
- **Two modes:**
  - **Quick scan** (about 5 minutes): `useCaseName, stage, buildPlatform, channels, accessModel, autonomy, dataSensitivity, tools`, plus `cloudEnvironment` if there's no organization profile yet.
  - **Full diagnostic:** all questions.
- **Screen layout:**
  - a section rail
  - the question in the center
  - a **"Why we ask"** consultant note
  - a "Not sure yet" option on every question; these answers feed the open-questions list
- **Emerging blueprint:** shown live as the **agent anatomy** diagram, updating with each answer.
- **Autosave:** users can resume, duplicate, rename and delete assessments.

### 6.2 Organization profile (`scope: org`)

All of these questions allow `unknown`.

| Question | Type | Options |
|---|---|---|
| `orgName` | text | |
| `industry` | single | |
| `cloudEnvironment` | single | `commercial`, `gcc`, `gcc-high-dod`, `other-sovereign` |
| `basePlan` | single | `m365-e7`, `m365-e5`, `m365-e3`, `o365-e3-ems-e3`, `business-premium`, `frontline-f1-f3`, `education-a5`, `education-a3`, `other` |
| `securitySuites` | single | Defender Suite and Purview Suite (or the frontline/SMB/education equivalents): `yes`, `no` |
| `agent365Status` | single | `none`, `trial`, `some-users`, `broad` |
| `frontierProgram` | single | `enrolled`, `not-enrolled` |
| `labelsProgram` | single | `broad`, `partial`, `not-yet` |
| `entraP1` | single | Users have Microsoft Entra ID P1 or higher: `yes`, `partial`, `no` |
| `defenderEndpoint` | single | Devices onboarded to Microsoft Defender for Endpoint: `most`, `some`, `none` |
| `intuneWindows` | single | Windows devices managed by Intune: `most`, `some`, `none` |
| `socPlatform` | single | `defender-xdr`, `other`, `none` |
| `agentEstate` | single | `one`, `handful`, `dozens`, `hundreds` |
| `orgGovernance` | multi | `ownerless-handling`, `policy-baseline`, `cmdb-integration`, `exec-reporting` |
| `securityOps` | multi | `soc-monitoring`, `threat-hunting`, `posture-management`, `insider-risk` |
| `shadowAI` | single | `yes`, `no` |

### 6.3 Use case questions (`scope: useCase`)

**1. Profile**

| Question | Type | Options |
|---|---|---|
| `useCaseName` | text | |
| `businessOutcome` | longtext | |
| `businessFunction` | single | |
| `stage` | single | `idea`, `prototype`, `pilot`, `production`, `scaling` |
| `audience` | multi | `employees`, `frontline`, `partners`, `customers` |
| `expectedUsers` | single | `lt-50`, `50-500`, `500-5000`, `gt-5000` |
| `businessValue` | scale | 1–5 |

**2. Build & run: where it's being developed**

| Question | Type | Options |
|---|---|---|
| `buildPlatform` | single | `m365-agent-builder`, `copilot-studio`, `microsoft-foundry`, `pro-code-microsoft`, `pro-code-third-party`, `hyperscaler` (Amazon Bedrock / Google Vertex AI), `saas-platform`, `partner-agent`, `local-agent`, `undecided` |
| `publisherType` | single | `microsoft`, `external-partner`, `published-by-org`, `shared-by-creator`. These match the Agent Registry's agent types, so users learn where the agent will show up. |
| `codeStack` | single | Shown for pro-code only: `python`, `node`, `dotnet`, `other` |
| `hosting` | multi | `microsoft-cloud`, `aws`, `google-cloud`, `other-cloud-onprem`, `user-devices` |
| `channels` | multi | `m365-copilot`, `teams`, `outlook`, `m365-apps`, `sharepoint`, `web-or-custom`, `background`. The first five match the registry's channel filter. |

**3. Identity & autonomy (Frontier Firm phase)**

| Question | Type | Options |
|---|---|---|
| `accessModel` | single | `delegated`, `own-teammate` (Frontier preview), `own-background`, `mixed` |
| `autonomy` | single | `suggests`, `approval-gated`, `autonomous` |
| `actions` | multi | `read`, `create-content`, `update-records`, `transactions`, `change-config`, `communicate-externally` |
| `triggers` | multi | `user-prompt`, `events`, `schedule`, `other-agents` |
| `sponsor` | single | `yes`, `not-yet` |
| `managedDevices` | single | `yes`, `mixed`, `no`, `n-a` |

**4. Data**

| Question | Type | Options |
|---|---|---|
| `dataSources` | multi | `m365`, `dataverse`, `lob`, `third-party-saas`, `public-web`, `maker-files` |
| `dataSensitivity` | single | `public`, `internal`, `confidential`, `highly-confidential` |
| `regulatedData` | multi | `personal`, `payment-card`, `health`, `financial-reporting`, `employee`, `trade-secrets`, `none` |
| `generatesContent` | boolean | |
| `obligations` | multi | `legal-hold`, `records-retention`, `regulator-audit`, `ai-regulation`, `none` |

**5. Tools**

| Question | Type | Options |
|---|---|---|
| `tools` | multi | `microsoft-mcp`, `third-party-mcp`, `connectors-apis`, `code-execution`, `web-browsing`, `computer-use`, `none` |
| `agentToAgent` | boolean | |
| `networkEgress` | single | `yes`, `no` |

**6. Agent governance**

| Question | Type | Options |
|---|---|---|
| `agentGovernance` | multi | `approval`, `restrict-audience`, `exec-reporting` |

**7. Readout details.** Optional and stored locally: engagement name, prepared by, date, and an optional logo for co-branding.

### 6.4 Rule engine (`src/lib/engine/`)

```ts
type Condition =
  | { always: true }
  | { all: Condition[] } | { any: Condition[] } | { not: Condition }
  | { q: string; equals?: string; in?: string[]; includes?: string; includesAny?: string[]; answered?: boolean; unknown?: boolean };

interface Rule {
  id: string;
  description: string;                       // shown on the Methodology page
  when: Condition;
  recommend?: {
    capability: string; level: Level; because: string; detail?: string;
    evidence: Evidence; sourceIds?: string[]; wave?: 1 | 2 | 3;
  }[];
  advisories?: string[];                     // ids in advisories.yaml
}
```

**Merging and ordering**
- The highest level wins: Essential beats Recommended, which beats Consider.
- Keep every reason, each with its rule ID, evidence tag, sources and origin (`org` or `useCase`).
- Sort deterministically: pillar, then level, then shortName.

**Condition renderer.** `describeCondition()` turns any condition into plain English using the question and option labels. Use it for:
- "When it's in scope" on capability briefs
- "Becomes relevant if…" for capabilities that aren't in scope
- the Methodology page

**Outputs**
- **In-scope capabilities.** Each has:
  - level and reasons
  - wave and licensing tier
  - GCC availability and `sourcesDiffer`
  - control point, setup, owner team and lifecycle stages
- **Not in scope.** Each item includes its "becomes relevant if…" text.
- **Anatomy.** In-scope items grouped by control point.
- **Risks.** Triggered risks, showing which mitigating capabilities are in scope and which aren't.
- **Readiness.** For each in-scope capability, a status of `ready`, `gap` or `unknown`, taken from its `prerequisites` and the organization profile. Also an overall readiness percentage.
- **Operating model.** An owner team × lifecycle stage grid, plus the **agent decisions**: items whose setup is `agent` or `both`.
- **Integration path** with its builder checklist.
- **Frontier Firm phase** with a rationale.
- **Licensing:**
  - foundational vs premium counts
  - the license basis: delegated users, owner/sponsor/manager, or both
  - an estimated user range taken from `expectedUsers`
  - prerequisite and eligibility status from `basePlan` + `securitySuites`
  - sizing reports
- **Scores:** control intensity (Essential = 3, Recommended = 2, Consider = 1, normalized to 0–100), overall and by pillar.
- **What-if deltas** for each `what-ifs.yaml` entry: items added, items removed and level changes.
- **GCC handling:**
  - When the cloud is GCC, list the in-scope capabilities whose GCC Availability = No.
  - For GCC High/DoD and other sovereign clouds, add a "verify availability" advisory.
- **Open questions**, built from the `ifUnknown` text of unanswered questions.
- **`contentVersion`.**

### 6.5 Seed rules

Evidence tags: **S** = Stated, **I** = Inferred, **J** = Advisor judgment.

**Baseline**
- Always:
  - `registry-inventory`: Essential (I)
  - `governance-actions`: Essential (I)
- Pilot or later:
  - `observability`: Recommended (J); Essential in production or scaling (J)
  - `entra-sponsor-lifecycle`: Recommended (J)

**Platform**
- `hyperscaler` or `saas-platform`:
  - `registry-sync`: Essential (S: `sd-a365`, `a365-sdk`)
  - plus the `registry-sync` advisory
- Pro-code:
  - the `agent365-sdk` advisory (S)
  - `observability`: Essential (S: `a365-quickstart` says registration alone gives only catalog visibility)
  - `entra-access-packages`: Recommended (J)
- `copilot-studio`:
  - the `native` advisory (S)
  - with web browsing or network egress, `entra-network-controls`: Essential (S: the feature text names Copilot Studio agents)
- `local-agent`, or org `shadowAI = yes`:
  - `defender-shadow-ai`: Essential (S)
  - `defender-posture`: Essential (S)
  - `intune-block-local`: Recommended (S)
  - `intune-runtime-policy`: Recommended (I)
  - `entra-network-controls`: Recommended (S: "operating on user devices")

**Identity**
- `delegated` or `mixed`:
  - `entra-conditional-access`: Essential (S: "for agents with delegated access")
  - when managed devices are `yes` or `mixed`, `intune-device-compliance`: Recommended (I)
- Own access (`own-teammate`, `own-background` or `mixed`):
  - `entra-access-packages`: Essential (I)
  - `entra-sponsor-lifecycle`: Essential (I)
  - `policy-templates`: Recommended (J)
  - plus a licensing advisory that the owner, sponsor or manager must be licensed (S: `lic-faq`)
- `own-teammate`:
  - `purview-audit-ediscovery`: Essential (J)
  - `purview-ai-compliance`: Recommended (J)
  - `purview-dlm`: Recommended (J)
  - plus the Frontier preview advisory (S)
  - plus a readiness gap if `frontierProgram` isn't `enrolled`
- No sponsor yet:
  - `entra-sponsor-lifecycle`: Essential (I)
  - `lifecycle-automation`: Recommended (J)

**Autonomy & actions**
- Autonomous, or the agent updates records, executes transactions or changes configurations:
  - `defender-threat-protection`: Essential (I)
  - `observability`: Essential (J)
  - `purview-audit-ediscovery`: Essential (I)
  - `policy-templates`: Recommended (J)
- Communicates externally, or the audience includes partners or customers:
  - `purview-dlp`: Essential (I)
  - `purview-ai-compliance`: Recommended (J)

**Data**
- Confidential or higher, or any regulated data:
  - `purview-labels`: Essential (I)
  - `purview-dlp`: Essential (I)
  - `purview-dspm-ai`: Recommended (J)
  - `purview-insider-risk`: Recommended (J)
  - plus a labeling-readiness advisory when `labelsProgram` isn't `broad` (I)
- Generates content, or has records-retention obligations: `purview-dlm`: Essential (S)
- Legal hold or regulator audits: `purview-audit-ediscovery`: Essential (S)
- AI regulation: `purview-ai-compliance`: Essential (S)

**Tools**
- Any tool:
  - `tool-controls`: Essential (S: "including Microsoft MCP servers")
  - `defender-threat-protection`: Recommended (I)
  - `defender-posture`: Recommended (I)
- Computer use:
  - the Windows 365 for Agents advisory (S: `lic-faq`)
  - `intune-runtime-policy`: Consider (J)
- Agent-to-agent:
  - `observability`: Essential (J)
  - plus the Agent Map advisory (S: `a365-agent-map`; licensed per `lic-faq`)

**Organization profile.** These rules apply to every use case.
- Dozens or more agents:
  - `lifecycle-automation`: Essential (I)
  - `policy-templates`: Essential (J)
  - `registry-graph-api`: Recommended (J)
- `cmdb-integration`: `registry-graph-api`: Essential (I). Flag it when the cloud is GCC.
- `ownerless-handling`:
  - `lifecycle-automation`: Essential (I)
  - `entra-sponsor-lifecycle`: Essential (I)
- `policy-baseline`: `policy-templates`: Essential (I)
- Executive reporting (organization or agent level): `observability`: Essential (I)
- Agent governance `approval` or `restrict-audience`: `governance-actions`: Essential (S: "approve; assign agents to specific user/groups")
- `soc-monitoring`:
  - `defender-threat-protection`: Essential (S)
  - `defender-hunting`: Recommended (I)
- `threat-hunting`: `defender-hunting`: Essential (S)
- `posture-management`: `defender-posture`: Essential (S)
- `insider-risk`: `purview-insider-risk`: Essential (S)

### 6.6 Capability prerequisites (readiness)

Each readiness check is evaluated against the organization profile.

**Labels and DLP** (`purview-labels`, `purview-dlp`)
- Gap when `labelsProgram` isn't `broad` (I).
- Note that without Microsoft 365 E5-level Purview, there's no advanced classification or auto-labeling of grounding data (S: `lic-faq`).

**Network controls** (`entra-network-controls`)
- Gap when `entraP1` isn't `yes`, because network controls for cloud agents need Microsoft 365 E3 or Entra ID P1 (S: `lic-faq`).
- Network controls for local agents come through Entra Suite or standalone Entra offerings (S).

**Defender** (`defender-shadow-ai`, `defender-posture`, `defender-hunting`)
- Gap when the licensing prerequisites aren't met. Without them, Defender doesn't provide local-agent detection, posture and runtime protection, or hunting for cloud agents (S: `lic-faq`).
- Gap when `defenderEndpoint` isn't `most` (I).

**Intune** (`intune-block-local`, `intune-runtime-policy`, `intune-device-compliance`)
- Gap when `intuneWindows` isn't `most` (I).
- Note that without the prerequisites, Intune doesn't provide controls for local agents on Windows (S: `lic-faq`).

### 6.7 Validation and tests

**The build fails on:**
- duplicate IDs
- unknown references (capability, question, option value, advisory, pattern or risk)
- capabilities missing `featureText`, `sourceId` or `lastVerified`
- invalid enum values
- orphaned sources
- any capability without a control point, lifecycle stage or risk

**Vitest suites:**
- table-driven tests for each rule group
- the KPI assertions from §4
- merge precedence
- GCC gaps
- unknown answers becoming open questions
- `describeCondition` output

**Golden scenarios.** Tests fail if a `mustInclude` capability is missing or a `mustNotInclude` capability appears. Scenarios with no SME sign-off produce warnings, not failures.

## 7. Readout (board-ready)

The **Executive** view shows the ★ items. The **Technical** view shows everything.

| # | Item | Content | Executive view |
|---|---|---|---|
| 0 | Cover | "Agent 365 Control-Plane Readout: {use case}"; prepared for/by; date; "Draft for discussion"; content version | ★ |
| 1 | Executive summary | Three generated takeaways, answer first. A KPI strip: counts by level, foundational vs premium, platform vs agent decisions, readiness % | ★ |
| 2 | Exhibit 1 | Frontier Firm placement | ★ |
| 3 | Exhibit 2 | Agent anatomy: where each in-scope capability acts. Out-of-scope items are dimmed. | ★ |
| 4 | Exhibit 3 | Risks this agent introduces, and the controls that address them | ★ |
| 5 | Exhibit 4 | Capability detail table: level, why, evidence tag, licensing tier, GCC, sources differ | |
| 6 | Exhibit 5 | Platform foundations (set up once) vs. agent decisions (this agent's sponsor) | ★ |
| 7 | Exhibit 6 | Readiness: what's in place and what's missing | |
| 8 | Exhibit 7 | Operating model: owner teams × lifecycle stages | |
| 9 | Exhibit 8 | Integration path & builder checklist | |
| 10 | Exhibit 9 | Licensing implications: who to license for this access model, eligibility, sizing reports, sources-differ notes. No prices. | ★ |
| 11 | Exhibit 10 | Roadmap: Now / Next / Later | ★ |
| 12 | Exhibit 11 | What would change the answer (what-if toggles with deltas) | |
| 13 | Appendix | Out-of-scope items and what would bring each in; open questions; discovery questions to validate with stakeholders; sources and methodology; disclaimer | |

**Exports**
- Print to PDF.
- **PowerPoint**, six slides built with `pptxgenjs`:
  1. Title
  2. Executive summary
  3. Anatomy
  4. Risks → controls
  5. Roadmap
  6. Licensing & next steps
- Markdown.
- JSON that can be imported again.
- "Copy executive summary."
- The Use Case Canvas.

## 8. Use Case Canvas, Portfolio and Workshop kit

**Use Case Canvas** (`/canvas/:id`)
- A one-page canvas with these boxes:
  - Outcome & value
  - Users & channels
  - Triggers
  - Autonomy & human oversight
  - Identity & access
  - Knowledge & data
  - Tools & actions
  - Risks
  - Agent 365 controls, filled in automatically and grouped by control point
  - Success measures
  - Owner & sponsor
- A blank, printable version for workshops.
- Exports to PDF or a PowerPoint slide.

**Portfolio** (`/portfolio`)
- A 2×2 chart:
  - x-axis: control intensity
  - y-axis: business value
  - bubble size: expected users
  - quadrants: Accelerate, Govern to scale, Experiment, Reconsider
- A capability × use case heatmap.
- **Shared foundations:** "Enable once, benefits N use cases."
- Aggregated readiness gaps.
- The aggregated license basis (no prices).
- Import and export of a portfolio bundle.

**Workshop kit** (`/workshop`)
- A facilitator guide (`workshop.yaml`).
- Printable pattern cards.
- **Capability cards for a card-sort exercise:**
  - front: short name, layer and console
  - back: a plain-English summary and when the capability is in scope
- A blank canvas.
- **Presentation mode:** larger type, with editing controls hidden.

## 9. Information architecture

| Route | Purpose |
|---|---|
| `/` | Overview, with these elements:<ul><li>persona entry points ("Start as…")</li><li>the six north-star questions</li><li>computed KPIs and headline insights</li><li>the Observe/Govern/Secure framework</li><li>the Frontier Firm phase rail</li></ul> |
| `/capabilities` | Explorer:<ul><li>**Lenses:** Pillar · Console (who configures) · Layer (where it acts) · Lifecycle (when) · Risk (why) · Pattern (which use cases)</li><li>**Views:** Matrix · Cards · Table</li><li>Filters, plus search that covers `questionsItAnswers` and synonyms</li><li>Compare up to 4 capabilities</li><li>The URL stays in sync with the current view</li></ul> |
| `/capabilities/:id` | Capability brief:<ul><li>the verbatim quote</li><li>a plain-English explanation</li><li>without it / with it</li><li>**where** it acts (highlighted on the anatomy)</li><li>**when** it applies (lifecycle)</li><li>**who** owns it (owner team)</li><li>setup: platform or agent</li><li>licensing & availability</li><li>readiness prerequisites</li><li>when it's in scope, rendered from the rules, with evidence</li><li>patterns where it typically applies</li><li>discovery questions</li><li>sources differ</li><li>docs</li><li>last verified</li><li>review status</li><li>suggest a correction</li></ul> |
| `/patterns` | Pattern library, plus the generated Pattern × Capability matrix |
| `/patterns/:id` | Pattern brief:<ul><li>a narrative</li><li>typical platforms</li><li>the anatomy, with in-scope capabilities</li><li>risks</li><li>"Start an assessment from this pattern"</li></ul> |
| `/learn` | Learn hub:<ul><li>Concepts in 5 minutes</li><li>building blocks</li><li>glossary</li><li>myths vs. facts</li><li>where Agent 365 fits</li></ul> |
| `/diagnostic` | Organization profile + Use Case Diagnostic |
| `/diagnostic/:id/readout` | Readout |
| `/canvas/:id` | Use Case Canvas |
| `/portfolio` | Portfolio |
| `/workshop` | Workshop kit |
| `/methodology` | Levels, evidence tags, the rendered rules, sources and disclaimers |
| `/privacy` | What's stored, where it's stored, and GitHub Pages logging |
| `/whats-new` | Changelog, plus the patterns affected by each change |
| `/admin/content-health` | Hidden page listing items that are stale, in draft, or whose sources differ, plus golden scenarios that haven't been reviewed |

## 10. Design system: "Frontier Executive"

The goal is the polish of a top-tier consulting firm's client tool in a Microsoft Frontier Firm look: modern, confident, optimistic and calm.
- Keep every brand decision in `src/theme/tokens.ts`. It feeds both the CSS variables and a Fluent UI v9 theme.
- Don't ship Microsoft logos or Frontier Firm artwork unless approved assets are placed in `/public/brand/`.

**Palette.** These are placeholder tokens.

| Token | Value | Use |
|---|---|---|
| Ink navy | `#0A1A2F` | Text, dark bands |
| Slate | `#5A6B82` | Secondary text |
| Warm paper | `#FAF8F4` | Page canvas |
| White | `#FFFFFF` | Cards |
| Hairline | `#E4DFD6` | Rules |
| Interactive blue | `#0078D4` (hover `#106EBE`, pressed `#005A9E`) | Links and controls |
| "Frontier" gradient | `#0078D4` → `#7B5CD6` | Only the hero band, phase rail and accent rules |

- **Levels:**
  - Essential: solid ink navy
  - Recommended: interactive blue
  - Consider: slate outline
- **Evidence tags:**
  - Stated: solid outline
  - Inferred: dashed outline
  - Advisor judgment: dotted outline, plus a text label
- **Status:**
  - "Sources differ": amber `#8A5300` on `#FFF4DE`
  - "Not in GCC": neutral, with an icon
- **Heatmaps:** a single-hue blue ramp.
- **Color is never the only signal.** Always pair it with text or an icon.

**Typography**
- **Display and exhibit titles:** Source Serif 4, self-hosted through Fontsource, weights 600 and 700.
- **UI and body text:** Segoe UI Variable, then Segoe UI, then system-ui.
- **Numbers:** tabular numerals.
- **Type scale:** 12/14/16/20/24/32/44/56.
- **Section eyebrows:** small caps, for example "EXHIBIT 2 · AGENT ANATOMY".

**Layout**
- A 12-column grid, 1,240px maximum width, and an 8-point spacing scale.
- Hairline rules and 2–4px corner radii. Shadows only on overlays.
- Fluent UI System Icons, used sparingly. No emoji and no stock imagery.
- An SVG "horizon" motif in the hero.

**Writing style.** Document it in `docs/CONTENT-STYLE.md`.
- Lead with the answer.
- **Action titles:** every exhibit title is a full-sentence takeaway generated from data.
- MECE grouping (no overlaps, nothing missing).
- Short sentences.
- A "Source:" footnote under every exhibit.
- "Draft for discussion" on readouts.
- No hype words.

**Signature components**
- HeroBand
- KpiTile
- ExhibitFrame
- KeyTakeaway
- ConsultantNote
- Badges
- EvidenceTag
- LensSwitcher
- **AgentAnatomy:** the layered diagram with capability chips. It's interactive and used in the Explorer, patterns, diagnostic and readout.
- **RequestFlow:** a step-through animation.
- PatternMatrix
- RiskControlMap
- PillarConsoleMatrix
- FrontierPhaseRail
- ReadinessMeter
- OwnershipGrid
- WhatIfPanel
- TwoByTwo
- RoadmapSwimlane
- DiagnosticStepper
- CapabilityDrawer
- UseCaseCanvas
- CapabilityCard (printable)
- ViewDepthToggle
- GlossaryTerm
- DataTable

**Motion:** 150–200ms, and respect `prefers-reduced-motion`.

**Print:** a cover page, a running footer ("Draft for discussion · Not an official licensing determination · page X of Y"), a page break between exhibits, and support for both Letter and A4.

## 11. Tech stack and repository

**Stack**
- **App:**
  - Vite + React + TypeScript (strict)
  - React Router
  - Fluent UI React v9 with a custom theme
- **Libraries:**
  - Zod
  - `js-yaml`
  - MiniSearch
  - `lz-string`
  - `pptxgenjs`
- **Charts:** hand-built SVG, with no heavy chart library.
- **Testing:**
  - Vitest + Testing Library
  - Playwright + `@axe-core/playwright`
- **Linting:** ESLint + Prettier.
- **Runtime:** Node LTS.

**Scripts**
- `content:build` validates `/content` and compiles it to `src/generated/*.json`, stamped with `contentVersion` (the date plus a short hash). It runs before `dev`, `build` and `test`.
- `postbuild` writes `404.html` (a copy of `index.html`) and `.nojekyll` (§12).

```
content/            # ALL editable content (YAML, changelog.md, source-snapshot.json)
scripts/            # build-content.ts, check-source.ts, postbuild.ts
src/
  app/              # routes, layout, providers
  features/         # overview, explorer, patterns, learn, diagnostic, readout, canvas, portfolio, workshop, methodology
  components/       # design-system components
  lib/engine/       # pure rule engine, condition renderer + tests
  theme/            # tokens.ts, fluentTheme.ts, print.css
  generated/        # compiled content (git-ignored)
docs/               # HOW-TO-UPDATE.md, ARCHITECTURE.md, CONTENT-STYLE.md, DESIGN-SYSTEM.md, COMPREHENSION-TEST.md
.github/            # workflows/, ISSUE_TEMPLATE/, CODEOWNERS, copilot-instructions.md, instructions/, prompts/
```

## 12. Hosting on GitHub (GitHub Pages)

**Target.** A GitHub Pages **project site**, built and deployed by GitHub Actions. In the repo, go to Settings → Pages and set **Source** to **GitHub Actions** (`gh-pages-workflows`).

**Workflows** (`.github/workflows/`)
- **`ci.yml`** runs on pull requests and pushes. It runs:
  - install
  - `content:build`
  - lint
  - typecheck
  - unit tests
  - a build with the base path `/`, and a second build with `/<repo>/`
  - a Playwright smoke test plus axe checks against both builds
  
  It then uploads the built site as a downloadable preview artifact.
- **`deploy-pages.yml`** runs on push to `main` (after CI passes) and on manual dispatch.
  - It builds the site, then deploys it with the official actions `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`.
  - The deploy job needs the `pages: write` and `id-token: write` permissions, and uses the `github-pages` environment.
- **`source-watch.yml`** runs weekly and on demand (§13).
- **`release.yml`** is optional. On a `content-YYYY.MM.DD` tag, it creates a GitHub Release from `content/changelog.md`.

**Never hard-code the base path.** It changes with how the site is published:
- A project site is served from `https://<owner>.github.io/<repo>/`.
- A privately published site uses a different subdomain.
- A custom domain serves from `/`.

So:
- Set Vite's `base` from an environment variable that the workflow fills in. Use the `configure-pages` metadata (for example, its base path output) and fall back to `/<repo>/`.
- Use `import.meta.env.BASE_URL` for the router `basename` and for every internal link and asset.

**Client-side routing**
- Use React Router's browser router with clean URLs.
- `postbuild` writes `404.html` so deep links such as `/capabilities/purview-dlp` load, even on refresh.
- `postbuild` also writes `.nojekyll`.
- Keep share state in the URL fragment.
- Stretch goal: prerender the capability and pattern pages to static HTML. That gives a faster first paint and richer link previews.

**Easy access**
- Open Graph meta tags and a social-preview image, so links unfurl well in Teams, Outlook and LinkedIn. Set the same image as the repo's social preview.
- **README:**
  - the live link at the top
  - a screenshot
  - a "How to use" section
  - a "How to contribute" section
  - the disclaimer
- Put the site URL in the repo's About → Website field.
- Optionally, set up a custom domain (with a `CNAME` file) or a short link for a memorable URL.
- Turn on **GitHub Discussions** for Q&A.
- **Issue forms** (`.github/ISSUE_TEMPLATE/`):
  - Content correction
  - Source change / new capability
  - New pattern request
  - Bug
- **Suggest a correction:** the site's "Suggest a correction" link opens the right issue form, with the title and item ID prefilled. A `mailto:` fallback (`feedbackEmail` in `site.yaml`) covers people who don't have a GitHub account.

**Visibility.** Ask me about this in Phase 0, and document the decision in the README (`gh-pages-visibility`).
- **Public:** anyone with the link, including customers, can use the site.
- **Private:** only people with read access to the repository can open it. This needs an organization on **GitHub Enterprise Cloud**.
- **Enterprise Managed Users:** if the enterprise uses Enterprise Managed Users, Pages sites can *only* be private, and only enterprise members can open them. Customers couldn't reach the site.
- **Suggested path:**
  1. Pilot privately with Microsoft peers.
  2. Publish publicly after review.
  3. In the meantime, share exported readouts with customers.

**Privacy page wording.** "Your answers stay in your browser. This site sends nothing you enter to anyone, and it uses no cookies or analytics. GitHub Pages logs visitor IP addresses for security purposes."

**Repo hygiene** (so the repo is ready to go public)
- Branch protection on `main`: require a pull request, passing CI and a CODEOWNERS review.
- Dependabot version updates.
- Secret scanning.
- `CODEOWNERS`, `CONTRIBUTING.md` and `SECURITY.md`.
- A `LICENSE` chosen after review. Code and content may need different licenses.
- In `HOW-TO-UPDATE.md`, explain that a published change can take up to about 10 minutes to appear.

## 13. Keeping it current

1. **Source watch.** The weekly `scripts/check-source.ts` job:
   - fetches `sd-a365`
   - finds the feature table after the "Feature availability" heading (cheerio)
   - normalizes the text: NFKC, whitespace, zero-width characters, curly quotes, non-breaking hyphens
   - reads the page's last-updated date
   - diffs the table against `content/source-snapshot.json` and each `featureText`
   - opens or updates a `source-change` issue that lists the added, removed and changed rows

   It never edits content automatically.
2. **Content versioning.**
   - `contentVersion` appears in the footer and in every export.
   - Saved assessments store the version they were made with.
   - When someone opens an older assessment, a banner offers **"Re-run with latest content"** and shows the delta: new capabilities in scope and level changes.
3. **What's new.** Each changelog entry lists the capabilities it affects. The page shows which patterns are affected.
4. **Staleness.**
   - The build warns when any `lastVerified` date is more than 90 days old.
   - `/admin/content-health` lists items that are stale, in draft, or whose sources differ, plus golden scenarios that haven't been reviewed.
5. **Governance.**
   - `CODEOWNERS` assigns content files to SME reviewers: Entra, Purview, Defender, Intune, Microsoft 365 admin and licensing. Use placeholders for now.
   - Golden scenarios need SME sign-off.
6. **Copilot customizations.** Create these in Phase 1:
   - **`.github/copilot-instructions.md`:**
     - content is data
     - never invent facts or URLs
     - schema first
     - use tokens only
     - accessibility
     - tests for engine changes
     - a changelog entry for every content change
     - never hard-code the base path
   - **`.github/instructions/content.instructions.md`** with `applyTo: "content/**"`:
     - verbatim source text
     - required fields
     - evidence tags
     - editorial labels
     - `lastVerified`
     - no prices
   - **`.github/prompts/add-capability.prompt.md`:** turns a `source-change` issue into these updates:
     - capability YAML
     - snapshot
     - proposed rules
     - risk, control-point and lifecycle mappings
     - golden-scenario updates
     - changelog
     - tests
   - **`.github/prompts/add-pattern.prompt.md`:** adds a new pattern with canonical answers and a golden scenario.
7. **`docs/HOW-TO-UPDATE.md`** gives non-developers the end-to-end flow:
   1. Edit YAML in GitHub's web editor.
   2. Open a pull request.
   3. CI validates the change.
   4. Merge.
   5. The site redeploys to GitHub Pages automatically.

## 14. Quality bar and acceptance criteria

- **Content-driven:**
  - Adding a capability in YAML, with no code changes, makes it appear in every lens, KPI, matrix, search result, brief and methodology entry.
  - Rules, patterns and risks can reference it right away.
- **Generated matrix:** the Pattern × Capability matrix is regenerated from the rules. Nothing about it is hand-maintained.
- **Explained recommendations:**
  - Every in-scope recommendation shows at least one reason, with its evidence tag and source.
  - Every out-of-scope capability that a rule references shows "becomes relevant if…" text.
- **Tests:**
  - Unit tests assert the §4 KPIs.
  - Golden scenarios pass.
  - Each sample produces a stable readout snapshot.
- **No runtime network requests:** the site loads only its own static assets. Verify this in Playwright.
- **Accessibility:**
  - zero serious or critical axe violations
  - full keyboard support
  - every chart has an accessible data-table alternative
  - Lighthouse accessibility score of 95 or higher, and performance of 90 or higher
- **Print:** readouts and canvases print cleanly on both Letter and A4.
- **GitHub Pages:**
  - deep links, refresh on a deep link, and assets all work under both `/<repo>/` and `/`
  - merging to `main` publishes automatically
  - the README shows the live link
- **Comprehension test** (Phase 7).
  - **Panel:** 5 people:
    - 2 Microsoft sellers or specialists
    - 1 architect
    - 1 builder
    - 1 customer-side executive, or someone standing in for one
  - **Tasks:** 4 scripted tasks, each to be completed in under 2 minutes:
    1. Find which capabilities protect sensitive data, and who configures them.
    2. For the process-automation pattern, list the essential capabilities and where each one acts.
    3. Explain why registry sync applies to an Amazon Bedrock agent.
    4. Say what changes if the agent moves to GCC.
  - **Target:** at least 4 of 5 people succeed.
  - Record the results in `docs/COMPREHENSION-TEST.md`, and fix what fails.

## 15. Phases

Stop after each phase. Summarize what changed, show how to run it, list any open `TODO(verify)` items, and wait for my go-ahead.

- **Phase 0, Plan.** Don't write code yet.
  - Restate the goals in 5 bullets.
  - Propose the file tree, schemas and route map.
  - Propose a GitHub Pages plan: repo name, base path and the visibility question.
  - List your assumptions and open questions.
- **Phase 1, Foundation & first deploy.**
  - Scaffold the project.
  - Set up tokens, the theme and the layout shell.
  - Write the content schemas and seed content: the 26 capabilities with fit metadata, plus sources, pillars, consoles, control points and lifecycle.
  - Build content compilation and validation.
  - Add the Copilot instruction files.
  - Set up CI and the **GitHub Pages deploy workflow**, including base-path handling and the 404 fallback.
  - **Ship a first version to Pages in this phase**, so hosting works from day one.
- **Phase 2, Understand.**
  - Overview with persona entry points.
  - Explorer with lenses.
  - Capability briefs.
  - Learn hub: concepts, building blocks, glossary, myths vs. facts, and where Agent 365 fits.
- **Phase 3, Map to use cases.**
  - Rule engine, condition renderer and tests.
  - Patterns, plus the generated Pattern × Capability matrix.
  - Risk lens.
  - Golden scenarios.
- **Phase 4, Diagnostic.**
  - Organization profile and use case questions.
  - Start from a pattern.
  - Wizard, with the emerging anatomy.
  - Autosave and samples.
- **Phase 5, Readout & canvas.**
  - Exhibits.
  - Executive and Technical views.
  - What-if toggles.
  - Exports: PDF, PowerPoint, Markdown and JSON.
  - Use Case Canvas.
- **Phase 6, Portfolio & workshop kit.**
  - Portfolio.
  - Workshop kit.
  - Presentation mode.
- **Phase 7, Keep current & launch.**
  - Source watch.
  - Content versioning, with re-run deltas.
  - Content health page.
  - Issue forms, Discussions and CODEOWNERS.
  - README and docs.
  - Accessibility and performance pass.
  - Comprehension test.
  - The visibility decision.

Prefer small, reviewable commits. If anything here conflicts with an official source, flag it rather than guessing.

---

### What changed since v1

**New**
- **Pattern library**, with an engine-generated Pattern × Capability matrix.
- **Agent anatomy** (control points) and the request-flow walkthrough.
- **Lenses:** pillar, console, layer, lifecycle, risk and pattern.
- **Explainability:**
  - evidence tags (Stated, Inferred, Advisor judgment)
  - not-in-scope explanations
  - what-if deltas
- **Planning:**
  - platform vs. agent setup
  - owner teams × lifecycle
  - organization profile and readiness gaps
  - risk lens
- **Learn hub:** myths vs. facts, building blocks and where Agent 365 fits.
- **Personas**, the **Use Case Canvas** and the **Workshop kit**.
- **Maintenance:**
  - content versioning with re-run deltas
  - golden scenarios
  - CODEOWNERS
  - issue forms
  - comprehension test

**Renamed:** the recommendation levels are now Essential, Recommended and Consider.

**Hosting:** **GitHub Pages** replaces Azure Static Web Apps.
