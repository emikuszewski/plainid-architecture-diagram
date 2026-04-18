import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ExternalLink, Play, Pause, ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react';

// ============================================================================
// DATA
// ============================================================================

const DOCS_BASE = 'https://docs.plainid.io';

const COMPONENTS = {
  // ---- SaaS control plane ----
  'policy-admin': {
    name: 'Policy admin',
    fullName: 'Policy Administration Point',
    zone: 'saas',
    serviceName: 'policy-admin',
    version: 'v5.2611',
    port: '443',
    protocol: 'HTTPS · REST',
    status: 'healthy',
    description: 'Central UI where administrators author, version, and publish policies. Policies flow from here to every connected PAA through the secured sync channel.',
    connectsTo: ['Platform storage', 'Agent server', 'PAA sync channel'],
    dataFlow: {
      incoming: ['Admin UI actions', 'Policy authoring API calls'],
      outgoing: ['Published policies', 'Audit events']
    },
    docsPath: '/docs/administration-portal'
  },
  'platform-storage': {
    name: 'Platform storage',
    fullName: 'Tenant storage',
    zone: 'saas',
    serviceName: 'tenant-store',
    version: 'pg15 + redis7',
    protocol: 'Postgres + Redis',
    status: 'healthy',
    description: 'Durable store for tenant policies and compiled authorization artifacts. Postgres holds policy definitions and audit data; Redis manages sync channel state and compiled artifact cache.',
    connectsTo: ['Policy admin', 'Agent server'],
    dataFlow: {
      incoming: ['Policy writes from PAP', 'Sync state updates'],
      outgoing: ['Policy reads', 'Compiled artifact reads', 'Sync payloads to PAAs']
    },
    docsPath: '/docs/administration-portal'
  },
  'cloud-pdp': {
    name: 'Cloud PDP',
    fullName: 'Cloud-hosted Policy Decision Point',
    zone: 'saas',
    serviceName: 'cloud-pdp',
    version: 'v5.2611',
    port: '443',
    protocol: 'HTTPS',
    status: 'optional',
    technicalOnly: true,
    description: 'Optional SaaS-hosted PDP for deployments that do not require customer-hosted evaluation. Shares the same engine as the PAA runtime but operates from the control plane.',
    connectsTo: ['Platform storage', 'Policy admin'],
    dataFlow: {
      incoming: ['Authorization requests from SaaS apps'],
      outgoing: ['Decisions with obligations']
    },
    docsPath: '/docs/administration-portal'
  },
  'agent-server': {
    name: 'Agent server',
    fullName: 'PAA control channel endpoint',
    zone: 'saas',
    serviceName: 'agent-server',
    version: 'v5.2611',
    port: '8883',
    protocol: 'MQTT/TLS · persistent',
    status: 'healthy',
    technicalOnly: true,
    description: 'SaaS-side endpoint for the persistent outbound control channel from every PAA. Handles policy distribution, health monitoring, and control plane commands.',
    connectsTo: ['Platform storage', 'Policy admin', 'All connected PAAs'],
    dataFlow: {
      incoming: ['PAA health reports', 'PAA subscription requests'],
      outgoing: ['Policy sync payloads', 'Configuration updates']
    },
    docsPath: '/docs/administration-portal'
  },

  // ---- PAA data plane ----
  'pdp': {
    name: 'PDP',
    fullName: 'Policy Decision Point',
    zone: 'paa',
    serviceName: 'runtime',
    version: 'v5.2611',
    port: '8080',
    protocol: 'HTTPS · ext_authz',
    status: 'healthy',
    description: 'Evaluates authorization policies against request context and returns permit or deny with optional obligations. Runs locally inside the PAA for sub-millisecond latency and to keep all PII within the customer boundary.',
    connectsTo: ['PIP', 'Authorizers', 'Local policy cache (Redis)'],
    dataFlow: {
      incoming: ['Authorization requests from authorizers', 'Synced policies from SaaS'],
      outgoing: ['Permit or deny decisions', 'Obligations (filters, masks)']
    },
    technical: {
      latencyCached: '<1ms',
      latencyPipResolve: '~8ms',
      policyModels: 'ABAC · RBAC · ReBAC',
      deployment: 'Helm chart · standalone · sidecar',
      healthEndpoint: 'GET /api/version',
      tags: ['stateless', 'in-cluster', 'jwt-validated', 'horizontally-scaled']
    },
    docsPath: '/docs/administration-portal',
    deepDive: true
  },
  'pip': {
    name: 'PIP',
    fullName: 'Policy Information Point',
    zone: 'paa',
    serviceName: 'pip-operator',
    version: 'v5.2611',
    port: '8080',
    protocol: 'LDAP · JDBC · REST',
    status: 'healthy',
    description: 'Resolves attributes the PDP needs to evaluate a policy — user entitlements, resource metadata, relationship graphs. Queries customer data sources on demand through pluggable connectors.',
    connectsTo: ['PDP', 'Data stores', 'IdP'],
    dataFlow: {
      incoming: ['Attribute requests from PDP'],
      outgoing: ['Resolved attributes', 'Attribute cache updates']
    },
    docsPath: '/docs/administration-portal'
  },
  'agent': {
    name: 'Agent',
    fullName: 'PAA control plane client',
    zone: 'paa',
    serviceName: 'agent',
    version: 'v5.2611',
    protocol: 'MQTT · local Redis sync',
    status: 'healthy',
    technicalOnly: true,
    description: 'PAA control plane client. Maintains the persistent outbound tunnel to the SaaS agent-server, syncs policies to local Redis, and reports health back to the tenant.',
    connectsTo: ['Agent server (SaaS)', 'Local Redis', 'PDP', 'PIP'],
    dataFlow: {
      incoming: ['Policy sync payloads', 'Configuration updates'],
      outgoing: ['Health reports', 'Subscription heartbeats']
    },
    docsPath: '/docs/administration-portal'
  },

  // ---- Authorizers (customer PEP layer) ----
  'envoy': {
    name: 'Envoy sidecar',
    fullName: 'Istio Envoy HTTP filter',
    zone: 'authorizer',
    serviceName: 'envoy-sidecar',
    protocol: 'Istio · HTTP filter',
    status: 'healthy',
    description: 'Envoy sidecar authorizer deployed alongside service pods. Intercepts inbound HTTP traffic and calls the PDP via ext_authz filter before forwarding to the protected service.',
    connectsTo: ['PDP', 'Apps'],
    dataFlow: {
      incoming: ['HTTP requests to protected services'],
      outgoing: ['Authorization requests to PDP', 'Forwarded or denied traffic']
    },
    docsPath: '/docs/administration-portal'
  },
  'langchain-mcp': {
    name: 'LangChain + MCP',
    fullName: 'AI authorizer suite',
    zone: 'authorizer',
    serviceName: 'ai-authorizers',
    protocol: 'Python · JSON-RPC',
    status: 'healthy',
    description: 'Authorization wrappers for AI systems. LangChain authorizer implements the three-guardrail pattern (Categorizer, Retriever Filter, Anonymizer). MCP gateway enforces tool-level authorization for agent workflows.',
    connectsTo: ['PDP', 'AI agents'],
    dataFlow: {
      incoming: ['LangChain chain invocations', 'MCP tool calls'],
      outgoing: ['Authorization requests to PDP', 'Filtered or blocked chain outputs']
    },
    docsPath: '/docs/administration-portal'
  },
  'sql-authorizer': {
    name: 'SQL authorizer',
    fullName: 'Database authorization plugin',
    zone: 'authorizer',
    serviceName: 'sql-authorizer',
    protocol: 'DDL · row/col filter',
    status: 'healthy',
    description: 'Database-side authorizer that injects policy-based filters into SQL queries at the DDL layer. Enforces row-level and column-level access without requiring application changes.',
    connectsTo: ['PDP', 'Data stores'],
    dataFlow: {
      incoming: ['SQL queries from applications'],
      outgoing: ['Policy-filtered queries', 'Authorization requests to PDP']
    },
    docsPath: '/docs/administration-portal'
  },

  // ---- Customer resources ----
  'apps': {
    name: 'Apps',
    fullName: 'Protected applications',
    zone: 'resource',
    serviceName: 'apps',
    description: 'Customer-owned applications and services protected by PlainID authorization — web apps, REST APIs, gRPC services.',
    connectsTo: ['Envoy sidecar', 'IdP'],
    dataFlow: {
      incoming: ['User sessions with IdP tokens', 'Authorized traffic from Envoy'],
      outgoing: ['Enforced responses']
    }
  },
  'ai-agents': {
    name: 'AI agents',
    fullName: 'LLM chains and autonomous agents',
    zone: 'resource',
    serviceName: 'ai-agents',
    description: 'AI systems protected by the LangChain and MCP authorizers — LLM-driven chains, autonomous agents, and MCP-enabled tool-using assistants.',
    connectsTo: ['LangChain + MCP', 'Data stores'],
    dataFlow: {
      incoming: ['User prompts', 'Authorized data context'],
      outgoing: ['Filtered responses', 'Tool invocations']
    }
  },
  'data-stores': {
    name: 'Data stores',
    fullName: 'Databases and data repositories',
    zone: 'resource',
    serviceName: 'data-stores',
    description: 'Customer-owned databases and data stores protected by the SQL authorizer and queried by the PIP for attribute resolution.',
    connectsTo: ['SQL authorizer', 'PIP'],
    dataFlow: {
      incoming: ['Filtered queries from applications', 'Attribute queries from PIP'],
      outgoing: ['Filtered result sets', 'Attribute data']
    }
  },
  'idp': {
    name: 'Identity provider',
    fullName: 'OIDC identity source',
    zone: 'auxiliary',
    serviceName: 'idp',
    protocol: 'OIDC · SAML',
    description: 'Customer-managed identity provider — Okta, Ping, Entra ID, Auth0. Issues signed identity tokens consumed by applications and validated by the PAA for JWT-based authorization context.',
    connectsTo: ['Apps', 'PAA (JWT validation)'],
    dataFlow: {
      incoming: ['Authentication requests from apps'],
      outgoing: ['Signed tokens', 'User claims']
    },
    docsPath: '/docs/administration-portal'
  }
};

const FLOW_STEPS = [
  { arrows: [1], active: ['apps', 'envoy', 'pdp'], text: 'Envoy intercepts app request and calls PDP' },
  { arrows: [1, 2], active: ['pdp', 'pip'], text: 'PDP queries PIP for required attributes' },
  { arrows: [1, 2, 3], active: ['pip', 'data-stores'], text: 'PIP fetches attributes from customer data store' },
  { arrows: [1, 2, 3, 4], active: ['pdp', 'envoy', 'apps'], text: 'PDP returns decision; Envoy enforces and forwards to app' }
];

const VIEWS = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'flow', label: 'Request flow' },
  { id: 'technical', label: 'Technical', badge: 'adv' }
];

const LEGEND_ITEMS = [
  { swatch: '#9FE1CB', label: 'PlainID SaaS' },
  { swatch: '#CECBF6', label: 'Policy agent (PAA)' },
  { swatch: '#FAC775', label: 'Authorizer' },
  { swatch: '#D3D1C7', label: 'Customer resource' },
  { swatch: null, label: 'Protection unit', dashed: true }
];

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-5 flex justify-between items-start">
        <div>
          <h1 className="text-lg font-medium text-gray-900 tracking-tight">PlainID reference architecture</h1>
          <p className="text-sm text-gray-500 mt-1">Authorization platform components and data flow</p>
        </div>
        <a
          href={`${DOCS_BASE}/docs/administration-portal`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-600 hover:text-gray-900 mt-1 inline-flex items-center gap-1.5"
        >
          docs.plainid.io
          <ExternalLink size={12} />
        </a>
      </div>
    </header>
  );
}

function Nav({ currentView, onChange }) {
  return (
    <div className="flex justify-center mb-5">
      <div className="inline-flex gap-1 p-1 bg-gray-100 border border-gray-200 rounded-lg">
        {VIEWS.map(v => {
          const active = currentView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onChange(v.id)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {v.label}
              {v.badge && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200 font-normal">
                  {v.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ view }) {
  if (view === 'technical') return null;
  return (
    <div className="flex gap-6 justify-center flex-wrap pt-4 pb-2 text-xs text-gray-600">
      {LEGEND_ITEMS.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-sm border ${item.dashed ? 'border-dashed border-[#993C1D]' : 'border-gray-200'}`}
            style={{ background: item.swatch || 'transparent' }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function FlowControls({ step, playing, onPlay, onPrev, onNext, stepCount }) {
  return (
    <div className="flex items-center justify-center gap-3 py-2 mb-2 flex-wrap">
      <button
        onClick={onPrev}
        disabled={step === 0}
        className="px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
      >
        <ChevronLeft size={12} />Prev
      </button>
      <button
        onClick={onPlay}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        {playing ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
      </button>
      <button
        onClick={onNext}
        disabled={step === stepCount - 1}
        className="px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-md hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
      >
        Next<ChevronRight size={12} />
      </button>
      <div className="flex gap-1.5 items-center ml-1">
        {Array.from({ length: stepCount }).map((_, i) => (
          <span
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === step ? 'bg-purple-500 scale-150'
              : i < step ? 'bg-purple-400'
              : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DETAIL PANEL + DEEP DIVE
// ============================================================================

function DetailPanel({ componentId, view, onDeepDive }) {
  const component = componentId ? COMPONENTS[componentId] : null;

  if (!component) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-5 text-sm text-gray-600">
        <div className="font-medium text-gray-900 mb-1">Click any component for details</div>
        <div className="text-xs text-gray-500 mb-2">
          {view === 'architecture' && 'Architecture view · canonical deployment topology'}
          {view === 'flow' && 'Request flow · step through a live authorization'}
          {view === 'technical' && 'Technical · protocol and port detail'}
        </div>
        <div className="leading-relaxed">
          {view === 'architecture' && 'Dashed containers group each authorizer with the resource it protects. Switch to Technical for protocol detail, or Request flow to trace a live authorization request.'}
          {view === 'flow' && 'Use the play controls to step through an authorization request from app entry, through PDP decision, and back.'}
          {view === 'technical' && 'Service-level view with versions, ports, protocols, and health. Click any service card for deployment details.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mt-5 text-sm text-gray-600">
      <div className="font-medium text-gray-900 text-base">{component.fullName || component.name}</div>
      {component.serviceName && (
        <div className="text-xs font-mono text-gray-500 mt-1 mb-3">
          {component.serviceName}
          {component.version && <span> · {component.version}</span>}
          {component.port && <span> · :{component.port}</span>}
          {component.protocol && !component.port && <span> · {component.protocol}</span>}
        </div>
      )}
      <div className="leading-relaxed mb-4">{component.description}</div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {component.connectsTo && component.connectsTo.length > 0 && (
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Connects to</div>
            <ul className="text-xs space-y-1">
              {component.connectsTo.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <ArrowRight size={11} className="mt-0.5 text-gray-400 flex-shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {component.dataFlow && (
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Data in / out</div>
            <ul className="text-xs space-y-1">
              {component.dataFlow.incoming.map((d, i) => (
                <li key={`in-${i}`} className="text-green-700">↓ {d}</li>
              ))}
              {component.dataFlow.outgoing.map((d, i) => (
                <li key={`out-${i}`} className="text-blue-700">↑ {d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap mt-4">
        {component.deepDive && (
          <button
            onClick={() => onDeepDive(componentId)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            View deep dive <ArrowRight size={12} />
          </button>
        )}
        {component.docsPath && (
          <a
            href={`${DOCS_BASE}${component.docsPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Docs <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function DeepDiveModal({ componentId, onClose }) {
  useEffect(() => {
    if (!componentId) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [componentId, onClose]);

  if (!componentId) return null;
  const component = COMPONENTS[componentId];
  if (!component || !component.technical) return null;
  const { technical } = component;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-16 px-4 z-50 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-lg max-w-2xl w-full p-6 my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-lg font-mono font-medium text-gray-900">{component.serviceName}</div>
            <div className="text-sm text-gray-500">{component.fullName} · deep dive</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-5">{component.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="border border-gray-200 rounded-md bg-gray-50 px-3 py-2.5">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Latency (cached)</div>
            <div className="text-sm font-medium text-gray-900 mt-0.5">{technical.latencyCached}</div>
          </div>
          <div className="border border-gray-200 rounded-md bg-gray-50 px-3 py-2.5">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Policy models</div>
            <div className="text-sm font-medium text-gray-900 mt-0.5">{technical.policyModels}</div>
          </div>
          <div className="border border-gray-200 rounded-md bg-gray-50 px-3 py-2.5">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Deployment</div>
            <div className="text-sm font-medium text-gray-900 mt-0.5">{technical.deployment}</div>
          </div>
        </div>

        <div className="grid grid-cols-[140px_1fr] text-xs font-mono border-t border-gray-200">
          <div className="py-2 text-gray-500">port · protocol</div>
          <div className="py-2 text-gray-900 border-b border-gray-200">:{component.port} · {component.protocol}</div>
          <div className="py-2 text-gray-500 border-b border-gray-200">latency (pip resolve)</div>
          <div className="py-2 text-gray-900 border-b border-gray-200">{technical.latencyPipResolve}</div>
          <div className="py-2 text-gray-500 border-b border-gray-200">connects to</div>
          <div className="py-2 text-gray-900 border-b border-gray-200">{component.connectsTo.join(' · ')}</div>
          <div className="py-2 text-gray-500 border-b border-gray-200">health endpoint</div>
          <div className="py-2 text-gray-900 border-b border-gray-200">{technical.healthEndpoint}</div>
        </div>

        <div className="flex gap-1.5 mt-4 flex-wrap">
          {technical.tags.map(t => (
            <span key={t} className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-gray-600">
              {t}
            </span>
          ))}
        </div>

        {component.docsPath && (
          <div className="mt-5 pt-4 border-t border-gray-200">
            <a
              href={`${DOCS_BASE}${component.docsPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1.5"
            >
              Open in documentation
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SVG DIAGRAM (architecture + flow views share this)
// ============================================================================

function SvgComponent({ id, selected, onSelect, opacity, children, label }) {
  return (
    <g
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      style={{
        cursor: 'pointer',
        opacity,
        transition: 'opacity 0.35s'
      }}
      className={selected ? 'plainid-selected' : 'plainid-clickable'}
    >
      {children}
    </g>
  );
}

function FlowArrow({ active, d, color }) {
  return (
    <path
      d={d}
      stroke={color}
      strokeWidth="2.2"
      fill="none"
      markerEnd="url(#flow-arrow)"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.3s' }}
    />
  );
}

function FlowMarker({ n, active, cx, cy, color }) {
  return (
    <g style={{ opacity: active ? 1 : 0, transition: 'opacity 0.3s' }}>
      <circle cx={cx} cy={cy} r="11" fill={color} />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="500">{n}</text>
    </g>
  );
}

function DiagramSvg({ view, selectedId, onSelect, flowStep }) {
  const isFlowView = view === 'flow';
  const activeStep = isFlowView && flowStep != null ? FLOW_STEPS[flowStep] : null;
  const activeComponents = activeStep?.active || [];
  const activeArrows = activeStep?.arrows || [];

  const componentOpacity = (id) => {
    if (!isFlowView) return 1;
    return activeComponents.includes(id) ? 1 : 0.4;
  };
  const isArrowActive = (n) => activeArrows.includes(n);
  const zoneOpacity = isFlowView ? 0.15 : 1;

  const comp = (id, children) => (
    <SvgComponent
      id={id}
      selected={selectedId === id}
      onSelect={onSelect}
      opacity={componentOpacity(id)}
      label={COMPONENTS[id]?.fullName || COMPONENTS[id]?.name || id}
    >
      {children}
    </SvgComponent>
  );

  return (
    <svg viewBox="0 0 680 530" className="w-full" role="img">
      <title>PlainID reference architecture</title>
      <desc>Three deployment zones: PlainID SaaS platform, customer-hosted Policy Authorization Agent, and customer environment with authorizer-resource protection units.</desc>

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" />
        </marker>
      </defs>

      {/* Zone: SaaS */}
      <g style={{ opacity: zoneOpacity, transition: 'opacity 0.45s' }}>
        <rect x="40" y="30" width="600" height="82" rx="12" fill="#E1F5EE" stroke="#0F6E56" strokeWidth="0.5" />
        <text x="60" y="54" fill="#085041" fontSize="14" fontWeight="500">PlainID SaaS platform</text>
        <text x="60" y="71" fill="#0F6E56" fontSize="12">Control plane · managed by PlainID</text>
      </g>

      {comp('policy-admin',
        <>
          <rect x="250" y="54" width="140" height="42" rx="6" fill="#9FE1CB" fillOpacity="0.65" stroke="#0F6E56" strokeWidth="0.5" />
          <text x="320" y="73" fill="#085041" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Policy admin</text>
          <text x="320" y="89" fill="#0F6E56" fontSize="12" textAnchor="middle" dominantBaseline="central">PAP</text>
        </>
      )}

      {comp('platform-storage',
        <>
          <rect x="410" y="54" width="200" height="42" rx="6" fill="#9FE1CB" fillOpacity="0.65" stroke="#0F6E56" strokeWidth="0.5" />
          <text x="510" y="73" fill="#085041" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Platform storage</text>
          <text x="510" y="89" fill="#0F6E56" fontSize="12" textAnchor="middle" dominantBaseline="central">policies · sync · artifacts</text>
        </>
      )}

      {/* Sync arrow */}
      <g style={{ opacity: zoneOpacity, transition: 'opacity 0.45s' }}>
        <path d="M 340 112 L 340 158" stroke="#888780" strokeWidth="1" strokeDasharray="4 3" fill="none" markerEnd="url(#arrow)" />
        <text x="350" y="138" fill="#5F5E5A" fontSize="12" dominantBaseline="central">Policy sync · encrypted tunnel · no PII</text>
      </g>

      {/* Zone: PAA */}
      <g style={{ opacity: zoneOpacity, transition: 'opacity 0.45s' }}>
        <rect x="140" y="158" width="400" height="115" rx="12" fill="none" stroke="#534AB7" strokeWidth="0.5" strokeDasharray="5 3" />
        <text x="340" y="180" fill="#3C3489" fontSize="14" fontWeight="500" textAnchor="middle">Policy Authorization Agent</text>
        <text x="340" y="196" fill="#534AB7" fontSize="12" textAnchor="middle">Customer-hosted · Kubernetes or standalone</text>
      </g>

      {comp('pdp',
        <>
          <rect x="175" y="210" width="150" height="48" rx="8" fill="#CECBF6" stroke="#534AB7" strokeWidth="0.5" />
          <text x="250" y="229" fill="#3C3489" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">PDP</text>
          <text x="250" y="245" fill="#534AB7" fontSize="12" textAnchor="middle" dominantBaseline="central">Policy Decision Point</text>
        </>
      )}

      {comp('pip',
        <>
          <rect x="355" y="210" width="150" height="48" rx="8" fill="#CECBF6" stroke="#534AB7" strokeWidth="0.5" />
          <text x="430" y="229" fill="#3C3489" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">PIP</text>
          <text x="430" y="245" fill="#534AB7" fontSize="12" textAnchor="middle" dominantBaseline="central">Policy Information Point</text>
        </>
      )}

      {/* Architecture view: static flow labels */}
      {!isFlowView && (
        <g>
          <path d="M 125 363 C 125 310, 210 280, 250 260" stroke="#7F77DD" strokeWidth="1.2" strokeOpacity="0.55" fill="none" markerEnd="url(#arrow)" />
          <path d="M 280 363 L 260 265" stroke="#7F77DD" strokeWidth="1.2" strokeOpacity="0.55" fill="none" markerEnd="url(#arrow)" />
          <path d="M 435 363 C 435 300, 340 280, 280 265" stroke="#7F77DD" strokeWidth="1.2" strokeOpacity="0.55" fill="none" markerEnd="url(#arrow)" />
          <text x="555" y="295" fill="#5F5E5A" fontSize="12" dominantBaseline="central">Authorize</text>

          <path d="M 430 258 C 430 330, 440 380, 435 412" stroke="#888780" strokeWidth="1" strokeDasharray="4 3" fill="none" markerEnd="url(#arrow)" />
          <text x="485" y="335" fill="#5F5E5A" fontSize="12" dominantBaseline="central">Attributes</text>
        </g>
      )}

      {/* Flow view: numbered arrows */}
      {isFlowView && (
        <>
          <FlowArrow active={isArrowActive(1)} d="M 125 363 C 130 315, 190 285, 240 260" color="#7F77DD" />
          <FlowArrow active={isArrowActive(2)} d="M 325 234 L 355 234" color="#7F77DD" />
          <FlowArrow active={isArrowActive(3)} d="M 430 258 C 430 340, 440 380, 435 412" color="#7F77DD" />
          <FlowArrow active={isArrowActive(4)} d="M 260 258 C 150 310, 80 370, 115 412" color="#1D9E75" />

          <FlowMarker n={1} active={isArrowActive(1)} cx={165} cy={310} color="#7F77DD" />
          <FlowMarker n={2} active={isArrowActive(2)} cx={340} cy={215} color="#7F77DD" />
          <FlowMarker n={3} active={isArrowActive(3)} cx={452} cy={335} color="#7F77DD" />
          <FlowMarker n={4} active={isArrowActive(4)} cx={140} cy={335} color="#1D9E75" />
        </>
      )}

      {/* Zone: Customer environment */}
      <g style={{ opacity: zoneOpacity, transition: 'opacity 0.45s' }}>
        <rect x="40" y="295" width="600" height="225" rx="12" fill="#FAEEDA" stroke="#854F0B" strokeWidth="0.5" />
        <text x="60" y="318" fill="#633806" fontSize="14" fontWeight="500">Customer environment</text>
        <text x="60" y="334" fill="#854F0B" fontSize="12">Protection units pair each authorizer with its resource</text>

        <rect x="52" y="352" width="146" height="152" rx="10" fill="none" stroke="#993C1D" strokeWidth="0.5" strokeDasharray="4 3" strokeOpacity="0.55" />
        <rect x="207" y="352" width="146" height="152" rx="10" fill="none" stroke="#993C1D" strokeWidth="0.5" strokeDasharray="4 3" strokeOpacity="0.55" />
        <rect x="362" y="352" width="146" height="152" rx="10" fill="none" stroke="#993C1D" strokeWidth="0.5" strokeDasharray="4 3" strokeOpacity="0.55" />
      </g>

      {comp('envoy',
        <>
          <rect x="65" y="363" width="120" height="38" rx="6" fill="#FAC775" fillOpacity="0.85" stroke="#854F0B" strokeWidth="0.5" />
          <text x="125" y="378" fill="#633806" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Envoy sidecar</text>
          <text x="125" y="393" fill="#854F0B" fontSize="12" textAnchor="middle" dominantBaseline="central">Istio HTTP filter</text>
        </>
      )}
      {comp('apps',
        <>
          <rect x="65" y="412" width="120" height="80" rx="8" fill="#F1EFE8" stroke="#5F5E5A" strokeWidth="0.5" />
          <text x="125" y="436" fill="#2C2C2A" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Apps</text>
          <text x="125" y="456" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">Web, API</text>
          <text x="125" y="474" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">services</text>
        </>
      )}

      {comp('langchain-mcp',
        <>
          <rect x="220" y="363" width="120" height="38" rx="6" fill="#FAC775" fillOpacity="0.85" stroke="#854F0B" strokeWidth="0.5" />
          <text x="280" y="378" fill="#633806" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">LangChain + MCP</text>
          <text x="280" y="393" fill="#854F0B" fontSize="12" textAnchor="middle" dominantBaseline="central">AI authorizers</text>
        </>
      )}
      {comp('ai-agents',
        <>
          <rect x="220" y="412" width="120" height="80" rx="8" fill="#F1EFE8" stroke="#5F5E5A" strokeWidth="0.5" />
          <text x="280" y="436" fill="#2C2C2A" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">AI agents</text>
          <text x="280" y="456" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">LLM chains</text>
          <text x="280" y="474" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">tool calls</text>
        </>
      )}

      {comp('sql-authorizer',
        <>
          <rect x="375" y="363" width="120" height="38" rx="6" fill="#FAC775" fillOpacity="0.85" stroke="#854F0B" strokeWidth="0.5" />
          <text x="435" y="378" fill="#633806" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">SQL authorizer</text>
          <text x="435" y="393" fill="#854F0B" fontSize="12" textAnchor="middle" dominantBaseline="central">DDL · row/col filter</text>
        </>
      )}
      {comp('data-stores',
        <>
          <rect x="375" y="412" width="120" height="80" rx="8" fill="#F1EFE8" stroke="#5F5E5A" strokeWidth="0.5" />
          <text x="435" y="436" fill="#2C2C2A" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Data stores</text>
          <text x="435" y="456" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">Postgres, Snowflake</text>
          <text x="435" y="474" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">Oracle, LDAP</text>
        </>
      )}

      {comp('idp',
        <>
          <rect x="520" y="412" width="110" height="80" rx="8" fill="#F1EFE8" stroke="#5F5E5A" strokeWidth="0.5" />
          <text x="575" y="436" fill="#2C2C2A" fontSize="14" fontWeight="500" textAnchor="middle" dominantBaseline="central">Identity provider</text>
          <text x="575" y="456" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">OIDC, SAML</text>
          <text x="575" y="474" fill="#5F5E5A" fontSize="12" textAnchor="middle" dominantBaseline="central">Okta, Ping, Entra</text>
        </>
      )}
      <text x="575" y="395" fill="#5F5E5A" fontSize="12" textAnchor="middle" fontStyle="italic" style={{ opacity: zoneOpacity }}>identity source</text>
    </svg>
  );
}

// ============================================================================
// TECHNICAL VIEW
// ============================================================================

function TechCard({ id, selected, onSelect }) {
  const c = COMPONENTS[id];
  if (!c) return null;
  const statusColor = c.status === 'optional' ? 'bg-amber-500' : c.status === 'healthy' ? 'bg-green-600' : 'bg-gray-400';

  return (
    <button
      onClick={() => onSelect(id)}
      className={`text-left bg-gray-50 border rounded-lg p-3.5 transition-all w-full ${
        selected ? 'border-blue-500 bg-white' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-center mb-0.5">
        <span className="font-mono text-[13px] font-medium text-gray-900 truncate">{c.serviceName || c.name}</span>
        <span className="font-mono text-[11px] text-gray-500 inline-flex items-center gap-1.5 flex-shrink-0 ml-2">
          {c.version || ''}
          {c.status && <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />}
        </span>
      </div>
      <div className="text-[13px] text-gray-600 mt-0.5 truncate">{c.fullName || c.name}</div>
      {(c.protocol || c.port) && (
        <div className="font-mono text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-200 tracking-wider truncate">
          {c.port && `:${c.port} · `}{c.protocol}
        </div>
      )}
    </button>
  );
}

function TechZoneLabel({ children }) {
  return (
    <div className="font-mono text-[11px] text-gray-500 tracking-wide mb-2 mt-1 flex items-center gap-2">
      <span className="w-1 h-1 rounded-full bg-gray-400" />
      {children}
    </div>
  );
}

function TechConnector({ label }) {
  return (
    <div className="flex items-center gap-3 justify-center py-4">
      <div className="flex-1 max-w-[100px] h-px bg-gray-300" />
      <span className="font-mono text-[11px] text-gray-500 whitespace-nowrap">{label}</span>
      <div className="flex-1 max-w-[100px] h-px bg-gray-300" />
    </div>
  );
}

function TechnicalView({ selectedId, onSelect }) {
  return (
    <div>
      <TechZoneLabel>Control plane · SaaS (managed by PlainID)</TechZoneLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TechCard id="policy-admin" selected={selectedId === 'policy-admin'} onSelect={onSelect} />
        <TechCard id="agent-server" selected={selectedId === 'agent-server'} onSelect={onSelect} />
        <TechCard id="cloud-pdp" selected={selectedId === 'cloud-pdp'} onSelect={onSelect} />
        <TechCard id="platform-storage" selected={selectedId === 'platform-storage'} onSelect={onSelect} />
      </div>

      <TechConnector label="MQTT/TLS 1.3 · outbound-only · no PII crosses" />

      <TechZoneLabel>Data plane · PAA (customer-hosted · Kubernetes or standalone)</TechZoneLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TechCard id="agent" selected={selectedId === 'agent'} onSelect={onSelect} />
        <TechCard id="pdp" selected={selectedId === 'pdp'} onSelect={onSelect} />
        <TechCard id="pip" selected={selectedId === 'pip'} onSelect={onSelect} />
      </div>

      <TechConnector label="ext_authz · in-cluster · decisions + obligations" />

      <TechZoneLabel>Enforcement layer · authorizers (PEP integrations)</TechZoneLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <TechCard id="envoy" selected={selectedId === 'envoy'} onSelect={onSelect} />
        <TechCard id="langchain-mcp" selected={selectedId === 'langchain-mcp'} onSelect={onSelect} />
        <TechCard id="sql-authorizer" selected={selectedId === 'sql-authorizer'} onSelect={onSelect} />
      </div>

      <TechConnector label="inline · filtered responses" />

      <TechZoneLabel>Customer services</TechZoneLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <TechCard id="apps" selected={selectedId === 'apps'} onSelect={onSelect} />
        <TechCard id="ai-agents" selected={selectedId === 'ai-agents'} onSelect={onSelect} />
        <TechCard id="data-stores" selected={selectedId === 'data-stores'} onSelect={onSelect} />
        <TechCard id="idp" selected={selectedId === 'idp'} onSelect={onSelect} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ArchitectureDiagram() {
  const [currentView, setCurrentView] = useState('architecture');
  const [selectedId, setSelectedId] = useState(null);
  const [flowStep, setFlowStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [deepDiveId, setDeepDiveId] = useState(null);
  const intervalRef = useRef(null);

  // Reset flow state when leaving the flow view
  useEffect(() => {
    if (currentView !== 'flow') {
      setPlaying(false);
      setFlowStep(0);
    }
  }, [currentView]);

  // Playback interval
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
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  const handleDeepDive = useCallback((id) => {
    setDeepDiveId(id);
  }, []);

  const handlePlay = useCallback(() => {
    if (flowStep === FLOW_STEPS.length - 1) setFlowStep(0);
    setPlaying(p => !p);
  }, [flowStep]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        .plainid-selected > rect { stroke-width: 2 !important; stroke: #378ADD !important; }
        .plainid-clickable:focus { outline: 2px solid #378ADD; outline-offset: 2px; }
        .plainid-clickable:hover { opacity: 0.85 !important; }
      `}</style>

      <Header />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Nav currentView={currentView} onChange={setCurrentView} />

        {currentView === 'flow' && (
          <>
            <FlowControls
              step={flowStep}
              playing={playing}
              onPlay={handlePlay}
              onPrev={() => setFlowStep(s => Math.max(0, s - 1))}
              onNext={() => setFlowStep(s => Math.min(FLOW_STEPS.length - 1, s + 1))}
              stepCount={FLOW_STEPS.length}
            />
            <div className="text-center text-sm text-gray-600 min-h-[20px] mb-3">
              Step {flowStep + 1} of {FLOW_STEPS.length} · {FLOW_STEPS[flowStep].text}
            </div>
          </>
        )}

        <div className="border border-gray-200 bg-white rounded-xl p-5 shadow-sm">
          {currentView === 'technical' ? (
            <TechnicalView selectedId={selectedId} onSelect={handleSelect} />
          ) : (
            <DiagramSvg
              view={currentView}
              selectedId={selectedId}
              onSelect={handleSelect}
              flowStep={currentView === 'flow' ? flowStep : null}
            />
          )}
        </div>

        <DetailPanel
          componentId={selectedId}
          view={currentView}
          onDeepDive={handleDeepDive}
        />

        <Legend view={currentView} />
      </main>

      <footer className="border-t border-gray-200 py-4 px-4 mt-8">
        <div className="max-w-5xl mx-auto text-center text-xs text-gray-500">
          Maintained by the SE team · reference only
        </div>
      </footer>

      <DeepDiveModal
        componentId={deepDiveId}
        onClose={() => setDeepDiveId(null)}
      />
    </div>
  );
}
