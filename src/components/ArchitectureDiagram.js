import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Play, Pause, ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react';

// ============================================================================
// DATA
//
// All technical claims in this file are backed by docs.plainid.io.
// See /docs/pdp-1, /docs/pip-operator-service, /docs/agent-1,
// /docs/istio-and-osm-integrations, /docs/sql-database-authorizer,
// /docs/administration-portal, /docs/langchain-authorizer-use-case.
// Versions intentionally omitted — update source of truth elsewhere.
// ============================================================================

const DOCS_BASE = 'https://docs.plainid.io';

const COMPONENTS = {
  // ---- SaaS control plane ----
  'policy-admin': {
    name: 'policy-admin',
    fullName: 'Policy admin',
    longName: 'Policy Administration Point (PAP)',
    zone: 'saas',
    protocol: 'HTTPS · REST',
    status: 'healthy',
    shortDesc: 'Policy authoring UI',
    description: 'The PAP is where administrators author, version, and publish policies. Each PAA subscribes to this Platform and pulls its policies down over the Agent tunnel.',
    connectsTo: ['All connected PAAs via Agent tunnel'],
    dataFlow: {
      incoming: ['Admin UI actions', 'Policy authoring API'],
      outgoing: ['Published policies', 'Audit events']
    },
    docsPath: '/docs/administration-portal'
  },
  'cloud-pdp': {
    name: 'cloud-pdp',
    fullName: 'Default cloud PAA',
    longName: 'Built-in cloud-hosted PAA with preconfigured PDP',
    zone: 'saas',
    protocol: 'HTTPS',
    status: 'healthy',
    shortDesc: 'Built-in, preconfigured',
    description: 'Every tenant ships with a built-in cloud-hosted PAA that includes a preconfigured PDP. Customers can authorize against this directly via tenant-name.{region}.plainid.io, or deploy one or more customer-hosted PAAs for lower latency and data residency.',
    connectsTo: ['policy-admin'],
    dataFlow: {
      incoming: ['Authorization requests from apps using the cloud endpoint'],
      outgoing: ['Permit or deny decisions']
    },
    docsPath: '/docs/administration-portal'
  },

  // ---- PAA data plane (customer-hosted) ----
  'agent': {
    name: 'agent',
    fullName: 'Agent',
    longName: 'PAA control-plane client',
    zone: 'paa',
    port: '8081',
    protocol: 'WSS or HTTPS tunnel',
    status: 'healthy',
    shortDesc: 'Connects PAA to the Platform',
    description: 'Connects the PAA to the Platform. Opens a persistent outbound tunnel (WebSocket or HTTPS) to remote.{region}.plainid.io and pulls policy and configuration updates from the Platform down to the PAA. The health endpoint reports on tunnel connectivity and Redis.',
    connectsTo: ['policy-admin', 'runtime', 'pip-operator', 'Local Redis'],
    dataFlow: {
      incoming: ['Policy sync payloads', 'Configuration updates'],
      outgoing: ['Health reports', 'Subscription heartbeats']
    },
    docsPath: '/docs/agent-1'
  },
  'runtime': {
    name: 'runtime',
    fullName: 'PDP (runtime)',
    longName: 'Policy Decision Point',
    zone: 'paa',
    port: '8010',
    protocol: 'HTTPS · REST',
    status: 'healthy',
    shortDesc: 'Policy Decision Point',
    description: 'Evaluates authorization policies against request context and returns permit or deny with optional obligations (filters, masks). Runs locally inside the PAA so decisions stay close to the workload and no PII crosses the Platform boundary. Caches policies and identity records in Redis.',
    connectsTo: ['pip-operator', 'Authorizers', 'Local Redis'],
    dataFlow: {
      incoming: ['Authorization requests from authorizers', 'Synced policies from Platform'],
      outgoing: ['Decisions', 'Obligations (filters, masks)']
    },
    technical: {
      policyModels: 'Policy-Based Access Control (PBAC)',
      deployment: 'Helm chart · standalone',
      healthEndpoint: 'GET /api/runtime_health_check',
      ports: ':8010 (httpPort) · serviceMgmtPort configurable',
      tags: ['in-cluster', 'jwt-validated', 'redis-backed', 'horizontally-scaled']
    },
    docsPath: '/docs/pdp-1',
    deepDive: true
  },
  'pip-operator': {
    name: 'pip-operator',
    fullName: 'PIP',
    longName: 'Policy Information Point',
    zone: 'paa',
    port: '8089',
    protocol: 'JDBC · Teiid VDB',
    status: 'healthy',
    shortDesc: 'Virtual data layer',
    description: 'Resolves attributes the PDP needs — user entitlements, resource metadata, relationship graphs. Built on a Teiid Virtual Database engine that federates multiple data sources (JDBC, REST, LDAP, NoSQL) through a single query layer. Custom JDBC drivers can be pre-loaded.',
    connectsTo: ['runtime', 'Data sources', 'IdP'],
    dataFlow: {
      incoming: ['Attribute requests from PDP'],
      outgoing: ['Resolved attributes']
    },
    docsPath: '/docs/pip-operator-service'
  },

  // ---- Authorizers (PEP) ----
  'envoy-sidecar': {
    name: 'envoy-sidecar',
    fullName: 'Envoy authorizer',
    longName: 'Authorizer Operator, called via Envoy ext_authz',
    zone: 'authorizer',
    protocol: 'gRPC ext_authz',
    status: 'healthy',
    shortDesc: 'Istio / OSM ext_authz',
    description: 'The PlainID Authorizer Operator runs co-located with Envoy and exposes a gRPC ext_authz endpoint (typically localhost:50051). Envoy filters are configured to call it on every inbound request, the Operator calls the PDP, and the decision is enforced before traffic reaches the protected service.',
    connectsTo: ['runtime', 'apps'],
    dataFlow: {
      incoming: ['ext_authz calls from Envoy (HTTP requests)'],
      outgoing: ['Authorization requests to PDP', 'Permit / deny responses to Envoy']
    },
    docsPath: '/docs/istio-and-osm-integrations'
  },
  'ai-authorizers': {
    name: 'ai-authorizers',
    fullName: 'LangChain + MCP',
    longName: 'AI authorization components',
    zone: 'authorizer',
    protocol: 'Python (langchain_plainid)',
    status: 'healthy',
    shortDesc: 'LangChain + MCP',
    description: 'The langchain_plainid package provides three authorization points for AI workflows: PlainIDCategorizer authorizes user prompts, PlainIDRetriever filters RAG documents against user permissions before they reach the LLM, and an anonymization layer redacts PII in responses. The same components extend to MCP tool invocations.',
    connectsTo: ['runtime', 'ai-agents'],
    dataFlow: {
      incoming: ['LangChain chain invocations', 'MCP tool calls'],
      outgoing: ['Authorization requests to PDP', 'Filtered or redacted outputs']
    },
    docsPath: '/docs/langchain-authorizer-use-case'
  },
  'sql-authorizer': {
    name: 'sql-authorizer',
    fullName: 'SQL authorizer',
    longName: 'Real-time SQL query proxy',
    zone: 'authorizer',
    protocol: 'SQL proxy',
    status: 'healthy',
    shortDesc: 'Query-rewriting proxy',
    description: 'Real-time proxy service that intercepts SQL queries, calls the PDP Policy Resolution endpoint for the requesting identity, and rewrites the query with row, column, or cell-level filters before forwarding to the database. Officially supports PostgreSQL and Microsoft SQL Server, with Java Spring Boot and .NET client libraries.',
    connectsTo: ['runtime', 'data-stores'],
    dataFlow: {
      incoming: ['SQL queries from applications or SDK'],
      outgoing: ['Policy-modified queries', 'Authorization requests to PDP']
    },
    docsPath: '/docs/sql-database-authorizer'
  },

  // ---- Customer resources ----
  'apps': {
    name: 'apps',
    fullName: 'Apps',
    longName: 'Protected applications',
    zone: 'resource',
    shortDesc: 'Web, API, gRPC',
    description: 'Customer-owned applications — web apps, REST APIs, gRPC services — sitting behind the Envoy authorizer.',
    connectsTo: ['envoy-sidecar', 'idp'],
    dataFlow: {
      incoming: ['Authorized traffic from Envoy', 'User sessions with IdP tokens'],
      outgoing: ['Enforced responses']
    }
  },
  'ai-agents': {
    name: 'ai-agents',
    fullName: 'AI agents',
    longName: 'LLM chains and MCP-enabled agents',
    zone: 'resource',
    shortDesc: 'LLM chains, tools',
    description: 'AI systems protected by the LangChain and MCP authorization components — LLM-driven chains, autonomous agents, and tool-using assistants that invoke external capabilities through MCP.',
    connectsTo: ['ai-authorizers'],
    dataFlow: {
      incoming: ['User prompts', 'Authorized retrieval results'],
      outgoing: ['Filtered responses', 'Tool invocations']
    }
  },
  'data-stores': {
    name: 'data-stores',
    fullName: 'Data stores',
    longName: 'Databases protected by the SQL authorizer',
    zone: 'resource',
    shortDesc: 'PostgreSQL, MSSQL',
    description: 'Customer-owned databases protected by the SQL authorizer proxy. Officially supported engines are PostgreSQL and Microsoft SQL Server. The PIP also queries these stores for attribute resolution.',
    connectsTo: ['sql-authorizer', 'pip-operator'],
    dataFlow: {
      incoming: ['Policy-filtered queries', 'Attribute queries from PIP'],
      outgoing: ['Filtered result sets', 'Attribute data']
    }
  },
  'idp': {
    name: 'idp',
    fullName: 'Identity provider',
    longName: 'Customer-managed OIDC / SAML IdP',
    zone: 'identity',
    protocol: 'OIDC · SAML',
    shortDesc: 'Okta, Ping, Entra, Auth0',
    description: 'Customer-managed identity provider — Okta, Ping, Entra ID, Auth0. Issues signed identity tokens consumed by applications and validated by the PAA at authorization time. JWKS endpoints are configured per Scope.',
    connectsTo: ['apps', 'pip-operator'],
    dataFlow: {
      incoming: ['Authentication requests'],
      outgoing: ['Signed tokens', 'User claims']
    },
    docsPath: '/docs/administration-portal'
  }
};

const ZONES = {
  saas: {
    eyebrow: 'Control plane',
    title: 'PlainID SaaS',
    subtitle: 'Managed by PlainID. Policy authoring and built-in cloud PAA.',
    components: ['policy-admin', 'cloud-pdp'],
    accent: 'indigo'
  },
  paa: {
    eyebrow: 'Data plane',
    title: 'Policy Authorization Agent',
    subtitle: 'Customer-hosted. Helm or standalone deployment.',
    components: ['agent', 'runtime', 'pip-operator'],
    accent: 'indigo'
  },
  enforcement: {
    eyebrow: 'Enforcement',
    title: 'Customer environment',
    subtitle: 'Each authorizer paired with its protected resource.',
    units: [
      { label: 'unit · http', authorizer: 'envoy-sidecar', resource: 'apps' },
      { label: 'unit · ai', authorizer: 'ai-authorizers', resource: 'ai-agents' },
      { label: 'unit · data', authorizer: 'sql-authorizer', resource: 'data-stores' }
    ],
    accent: 'orange'
  },
  identity: {
    eyebrow: 'Identity',
    title: 'Identity source',
    subtitle: 'Customer-managed IdP. Issues tokens to apps.',
    components: ['idp'],
    accent: null
  }
};

const FLOW_STEPS = [
  {
    active: ['apps', 'envoy-sidecar', 'runtime'],
    text: 'Envoy intercepts app request and calls the PDP via ext_authz',
    barsActive: ['authz']
  },
  {
    active: ['runtime', 'pip-operator'],
    text: 'PDP queries PIP for required attributes',
    barsActive: []
  },
  {
    active: ['pip-operator', 'data-stores'],
    text: 'PIP fetches attributes from a customer data store',
    barsActive: ['authz']
  },
  {
    active: ['runtime', 'envoy-sidecar', 'apps'],
    text: 'PDP returns decision; Envoy enforces and forwards to the app',
    barsActive: ['authz']
  }
];

const VIEWS = [
  { id: 'architecture', label: 'architecture' },
  { id: 'flow', label: 'request flow' }
];

// ============================================================================
// LAYOUT
// ============================================================================

function Header() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-base font-medium text-neutral-900 dark:text-neutral-100 tracking-tight">
            PlainID reference architecture
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-mono tracking-wide">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500 align-middle mr-1.5" />
            control plane · data plane · enforcement
          </p>
        </div>
        <a
          href={`${DOCS_BASE}/docs/administration-portal`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 inline-flex items-center gap-1.5 transition-colors"
        >
          docs.plainid.io
          <ExternalLink size={11} />
        </a>
      </div>
    </header>
  );
}

function Nav({ currentView, onChange }) {
  return (
    <div className="flex gap-1 mb-7 font-mono text-xs">
      {VIEWS.map(v => {
        const active = currentView === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={`px-3 py-1.5 rounded-md transition-colors tracking-wide ${
              active
                ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 border border-transparent'
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// NODE CARD
// ============================================================================

function NodeCard({ id, onSelect, highlighted, dimmed, muted, selected }) {
  const c = COMPONENTS[id];
  if (!c) return null;

  const borderClasses = selected
    ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/20 dark:ring-indigo-400/20'
    : highlighted
    ? 'border-indigo-400 dark:border-indigo-500'
    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600';

  const bgClasses = muted
    ? 'bg-neutral-50 dark:bg-neutral-900/60'
    : 'bg-white dark:bg-neutral-950';

  const opacityClass = dimmed ? 'opacity-30' : 'opacity-100';

  return (
    <button
      onClick={() => onSelect && onSelect(id)}
      className={`text-left border rounded-md px-3 py-2.5 transition-all min-w-[150px] flex-1 ${bgClasses} ${borderClasses} ${opacityClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {c.name}
        </span>
        {c.status && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500 flex-shrink-0" />
        )}
      </div>
      {c.shortDesc && (
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
          {c.shortDesc}
        </div>
      )}
      {(c.port || c.protocol) && (
        <div className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5 tracking-wide truncate">
          {c.port ? `:${c.port} · ${c.protocol}` : c.protocol}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// ZONE ROW
// ============================================================================

function ZoneRow({ zone, children, last }) {
  const accentClass =
    zone.accent === 'indigo'
      ? 'md:border-l-2 md:border-indigo-500 dark:md:border-indigo-400 md:pl-3'
      : zone.accent === 'orange'
      ? 'md:border-l-2 md:border-orange-600 dark:md:border-orange-400 md:pl-3'
      : 'md:pl-3';

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 md:gap-6 py-5 ${
        !last ? 'border-b border-neutral-200 dark:border-neutral-800' : ''
      }`}
    >
      <div className={accentClass}>
        <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
          {zone.eyebrow}
        </div>
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {zone.title}
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
          {zone.subtitle}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ============================================================================
// SYNC BAR
// ============================================================================

function SyncBar({ label, active }) {
  const lineClass = active
    ? 'bg-indigo-500 dark:bg-indigo-400'
    : 'bg-neutral-200 dark:bg-neutral-800';
  const textClass = active
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-neutral-400 dark:text-neutral-500';

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`flex-1 h-px transition-colors ${lineClass}`} />
      <div className={`font-mono text-[10px] tracking-wider transition-colors whitespace-nowrap ${textClass}`}>
        {label}
      </div>
      <div className={`flex-1 h-px transition-colors ${lineClass}`} />
    </div>
  );
}

// ============================================================================
// PROTECTION UNIT
// ============================================================================

function ProtectionUnit({ label, authorizerId, resourceId, activeSet, isFlow, onSelect, selectedId }) {
  return (
    <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-md p-2 flex flex-col gap-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 dark:text-neutral-500 px-1">
        {label}
      </div>
      <NodeCard
        id={authorizerId}
        onSelect={onSelect}
        selected={selectedId === authorizerId}
        highlighted={isFlow && activeSet.has(authorizerId)}
        dimmed={isFlow && !activeSet.has(authorizerId)}
      />
      <NodeCard
        id={resourceId}
        onSelect={onSelect}
        muted
        selected={selectedId === resourceId}
        highlighted={isFlow && activeSet.has(resourceId)}
        dimmed={isFlow && !activeSet.has(resourceId)}
      />
    </div>
  );
}

// ============================================================================
// MAIN DIAGRAM LAYOUT (shared by architecture + flow views)
// ============================================================================

function DiagramLayout({ isFlow, selectedId, onSelect, flowStep }) {
  const step = isFlow && flowStep != null ? FLOW_STEPS[flowStep] : null;
  const activeSet = new Set(step?.active || []);
  const barsActive = new Set(step?.barsActive || []);

  const nodeProps = (id) => ({
    id,
    onSelect,
    selected: selectedId === id,
    highlighted: isFlow && activeSet.has(id),
    dimmed: isFlow && !activeSet.has(id)
  });

  return (
    <div>
      <ZoneRow zone={ZONES.saas}>
        <div className="flex gap-2 flex-wrap">
          {ZONES.saas.components.map(id => <NodeCard key={id} {...nodeProps(id)} />)}
        </div>
      </ZoneRow>

      <SyncBar
        label="policy sync · Agent tunnel (wss or https) · no PII crosses"
        active={false}
      />

      <ZoneRow zone={ZONES.paa}>
        <div className="flex gap-2 flex-wrap">
          {ZONES.paa.components.map(id => <NodeCard key={id} {...nodeProps(id)} />)}
        </div>
      </ZoneRow>

      <SyncBar
        label="ext_authz · authorization requests + obligations"
        active={barsActive.has('authz')}
      />

      <ZoneRow zone={ZONES.enforcement}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ZONES.enforcement.units.map(u => (
            <ProtectionUnit
              key={u.label}
              label={u.label}
              authorizerId={u.authorizer}
              resourceId={u.resource}
              activeSet={activeSet}
              isFlow={isFlow}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      </ZoneRow>

      <ZoneRow zone={ZONES.identity} last>
        <div className="flex gap-2 flex-wrap">
          {ZONES.identity.components.map(id => (
            <NodeCard key={id} {...nodeProps(id)} muted />
          ))}
        </div>
      </ZoneRow>
    </div>
  );
}

// ============================================================================
// FLOW CONTROLS
// ============================================================================

function FlowControls({ step, playing, onPlay, onPrev, onNext, stepCount }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 pb-4 border-b border-neutral-200 dark:border-neutral-800">
      <div className="text-xs text-neutral-600 dark:text-neutral-400 flex-1 min-w-0">
        <span className="font-mono text-neutral-400 dark:text-neutral-500 mr-2">
          {String(step + 1).padStart(2, '0')} / {String(stepCount).padStart(2, '0')}
        </span>
        {FLOW_STEPS[step].text}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onPrev}
          disabled={step === 0}
          className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-700 dark:text-neutral-300"
          aria-label="Previous step"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={onPlay}
          className="py-1.5 px-3 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors inline-flex items-center gap-1.5 text-xs font-mono font-medium"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />}
          {playing ? 'pause' : 'play'}
        </button>
        <button
          onClick={onNext}
          disabled={step === stepCount - 1}
          className="p-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-neutral-700 dark:text-neutral-300"
          aria-label="Next step"
        >
          <ChevronRight size={14} />
        </button>
        <div className="flex gap-1 items-center ml-2">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === step ? 'bg-indigo-500 dark:bg-indigo-400 w-4'
                : i < step ? 'bg-indigo-300 dark:bg-indigo-700 w-1'
                : 'bg-neutral-200 dark:bg-neutral-800 w-1'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL PANEL
// ============================================================================

function DetailPanel({ componentId, onDeepDive }) {
  const c = componentId ? COMPONENTS[componentId] : null;

  if (!c) {
    return (
      <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-md px-4 py-3 mt-6 text-xs font-mono text-neutral-400 dark:text-neutral-500">
        click any service for details →
      </div>
    );
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-md p-4 mt-6 bg-white dark:bg-neutral-950">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {c.name}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {c.longName || c.fullName}
          </div>
        </div>
        <div className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 tracking-wide text-right flex-shrink-0">
          {c.port && <div>:{c.port}</div>}
          {c.protocol && <div className="truncate max-w-[180px]">{c.protocol}</div>}
        </div>
      </div>

      <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed my-3">
        {c.description}
      </p>

      {c.connectsTo && c.connectsTo.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
              Connects to
            </div>
            <ul className="text-xs space-y-0.5">
              {c.connectsTo.map((n, i) => (
                <li key={i} className="font-mono text-neutral-700 dark:text-neutral-300">→ {n}</li>
              ))}
            </ul>
          </div>
          {c.dataFlow && (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5">
                Data
              </div>
              <ul className="text-xs space-y-0.5 font-mono">
                {c.dataFlow.incoming.map((d, i) => (
                  <li key={`in-${i}`} className="text-green-700 dark:text-green-500">↓ {d}</li>
                ))}
                {c.dataFlow.outgoing.map((d, i) => (
                  <li key={`out-${i}`} className="text-indigo-700 dark:text-indigo-400">↑ {d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4 flex-wrap">
        {c.deepDive && (
          <button
            onClick={() => onDeepDive(componentId)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md hover:bg-neutral-700 dark:hover:bg-neutral-300 transition-colors"
          >
            deep dive <ArrowRight size={11} />
          </button>
        )}
        {c.docsPath && (
          <a
            href={`${DOCS_BASE}${c.docsPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            docs <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DEEP DIVE MODAL
// ============================================================================

function DeepDiveModal({ componentId, onClose }) {
  useEffect(() => {
    if (!componentId) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [componentId, onClose]);

  if (!componentId) return null;
  const c = COMPONENTS[componentId];
  if (!c || !c.technical) return null;
  const { technical } = c;

  const rows = [
    ['ports', technical.ports || (c.port ? `:${c.port}` : '—')],
    ['protocol', c.protocol],
    ['policy models', technical.policyModels],
    ['deployment', technical.deployment],
    ['health endpoint', technical.healthEndpoint],
    ['connects to', c.connectsTo.join(' · ')]
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-16 px-4 z-50 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl max-w-2xl w-full my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-900 flex justify-between items-start">
          <div>
            <div className="font-mono text-base font-medium text-neutral-900 dark:text-neutral-100">
              {c.name}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
              {c.longName} · deep dive
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-5">
            {c.description}
          </p>

          <div className="font-mono text-xs border-t border-neutral-100 dark:border-neutral-900">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] py-2 border-b border-neutral-100 dark:border-neutral-900 last:border-b-0 gap-3">
                <div className="text-neutral-500 dark:text-neutral-400">{k}</div>
                <div className="text-neutral-900 dark:text-neutral-100 break-words">{v}</div>
              </div>
            ))}
          </div>

          {technical.tags && (
            <div className="flex gap-1.5 mt-4 flex-wrap">
              {technical.tags.map(t => (
                <span
                  key={t}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {c.docsPath && (
            <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-900">
              <a
                href={`${DOCS_BASE}${c.docsPath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5"
              >
                Open in documentation
                <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function ArchitectureDiagram() {
  const [currentView, setCurrentView] = useState('architecture');
  const [selectedId, setSelectedId] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [deepDiveId, setDeepDiveId] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (currentView !== 'flow') {
      setPlaying(false);
      setFlowStep(0);
    }
  }, [currentView]);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setFlowStep(s => {
        if (s >= FLOW_STEPS.length - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 1800);
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  const handleSelect = useCallback((id) => {
    setSelectedId(prev => (prev === id ? null : id));
  }, []);

  const handleDeepDive = useCallback((id) => {
    setDeepDiveId(id);
  }, []);

  const handlePlay = useCallback(() => {
    if (flowStep === FLOW_STEPS.length - 1) setFlowStep(0);
    setPlaying(p => !p);
  }, [flowStep]);

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 antialiased">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Nav currentView={currentView} onChange={setCurrentView} />

        {currentView === 'flow' && (
          <FlowControls
            step={flowStep}
            playing={playing}
            onPlay={handlePlay}
            onPrev={() => setFlowStep(s => Math.max(0, s - 1))}
            onNext={() => setFlowStep(s => Math.min(FLOW_STEPS.length - 1, s + 1))}
            stepCount={FLOW_STEPS.length}
          />
        )}

        <DiagramLayout
          isFlow={currentView === 'flow'}
          selectedId={selectedId}
          onSelect={handleSelect}
          flowStep={currentView === 'flow' ? flowStep : null}
        />

        <DetailPanel componentId={selectedId} onDeepDive={handleDeepDive} />
      </main>

      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-4 px-6 mt-12">
        <div className="max-w-5xl mx-auto text-center text-xs font-mono text-neutral-400 dark:text-neutral-500">
          Maintained by the SE team · reference only
        </div>
      </footer>

      <DeepDiveModal componentId={deepDiveId} onClose={() => setDeepDiveId(null)} />
    </div>
  );
}
