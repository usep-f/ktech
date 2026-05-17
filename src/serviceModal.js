/**
 * KTech Solutions — Service Documentation Modal
 * Dynamically injects a service documentation modal into #modal-root
 * and opens it with unique content per service.
 *
 * Template based on /src/modals/servicemodal.html
 */

// ═══════════════════════════════════════════
// SERVICE DOCUMENTATION DATA
// ═══════════════════════════════════════════
const serviceData = {
  "app-development": {
    icon: "smartphone",
    title: "App Development",
    sections: [
      {
        heading: "Technical Specifications",
        columns: [
          {
            subheading: "Mobile Frameworks",
            type: "paragraph",
            content:
              "Our mobile engineering team builds with React Native and Flutter for cross-platform delivery, alongside Swift (iOS) and Kotlin (Android) for native-first performance. Every build is compiled against the latest SDK targets with ahead-of-time (AOT) compilation for sub-second cold starts.",
          },
          {
            subheading: "Backend Integration",
            type: "list",
            items: [
              "RESTful & GraphQL API architectures with schema validation",
              "Firebase & Supabase real-time database synchronization",
              "OAuth 2.0 / OpenID Connect secure authentication flows",
              "Push notification orchestration via FCM & APNs",
            ],
          },
        ],
      },
      {
        heading: "Architecture Overview",
        content:
          "Our mobile application architecture follows a clean MVVM pattern with repository-based data layers, ensuring complete separation of concerns and testability. State management is handled through reactive streams (BLoC/Riverpod for Flutter, Redux Toolkit for React Native), enabling predictable UI updates and offline-first data caching via embedded SQLite databases. The CI/CD pipeline leverages Fastlane for automated signing, building, and distribution to TestFlight and Google Play Internal Testing tracks, with Detox and Appium powering end-to-end UI test suites across 30+ device configurations.",
      },
      {
        heading: "Deployment Requirements",
        columns: [
          {
            subheading: "Platform Targets",
            type: "list",
            items: [
              "iOS 16+ / Android 12+ (API 31) minimum targets",
              "Tablet-optimized adaptive layouts",
              "WearOS & watchOS companion app support",
              "App Clip / Instant App lightweight entry points",
            ],
          },
          {
            subheading: "Performance Benchmarks",
            type: "list",
            items: [
              "< 2s Time-to-Interactive on mid-range devices",
              "< 50 MB initial download size (post-compression)",
              "60 fps scrolling with zero jank frames",
              "Crash-free rate target: 99.9%+",
            ],
          },
        ],
      },
    ],
  },

  "web-development": {
    icon: "web",
    title: "Web Development",
    sections: [
      {
        heading: "Technical Specifications",
        columns: [
          {
            subheading: "Frontend Stack",
            type: "paragraph",
            content:
              "We develop with modern frameworks including Next.js 14, Nuxt 3, and SvelteKit, leveraging server-side rendering (SSR), static site generation (SSG), and incremental static regeneration (ISR) to deliver optimal Core Web Vitals scores. Styling is managed through design-token-driven systems using Tailwind CSS and CSS custom properties.",
          },
          {
            subheading: "Backend & API Layer",
            type: "list",
            items: [
              "Node.js / Deno / Bun runtime environments",
              "PostgreSQL with Prisma ORM & connection pooling",
              "Redis-backed session management & caching layers",
              "WebSocket / Server-Sent Events for real-time data",
            ],
          },
        ],
      },
      {
        heading: "Architecture Overview",
        content:
          "Our web platform architecture is built on a Jamstack-inspired, edge-first paradigm. Static assets are served from a globally distributed CDN with sub-30ms TTFB, while dynamic API routes execute at the edge through Vercel Edge Functions or Cloudflare Workers. Database queries are optimized with prepared statements and materialized views, with PgBouncer managing connection pools for high-concurrency scenarios. Authentication flows use short-lived JWTs with HTTP-only secure cookies and CSRF token rotation, while role-based access control (RBAC) gates every server action and API endpoint.",
      },
      {
        heading: "Deployment Requirements",
        columns: [
          {
            subheading: "Performance Standards",
            type: "list",
            items: [
              "Lighthouse Performance score ≥ 95",
              "LCP < 2.5s, FID < 100ms, CLS < 0.1",
              "WCAG 2.1 AA accessibility compliance",
              "Progressive Web App (PWA) installable",
            ],
          },
          {
            subheading: "Infrastructure",
            type: "list",
            items: [
              "CI/CD via GitHub Actions with preview deployments",
              "Automated visual regression testing (Playwright)",
              "Feature flag management via LaunchDarkly",
              "Error tracking & RUM via Sentry integration",
            ],
          },
        ],
      },
    ],
  },

  "infrastructure-setup": {
    icon: "dns",
    title: "Infrastructure Setup",
    sections: [
      {
        heading: "Technical Specifications",
        columns: [
          {
            subheading: "Compute Core",
            type: "paragraph",
            content:
              "Our infrastructure runs on an edge-optimized Kubernetes v1.28.4 runtime with Firecracker MicroVM containers for superior isolation, delivering a dedicated 10Gbps line rate throughput. Nodes are provisioned via Terraform IaC with immutable AMIs built through Packer pipelines.",
          },
          {
            subheading: "Storage Cluster",
            type: "list",
            items: [
              "NVMe-over-Fabrics (NVMe-oF) high-performance storage",
              "AES-256 encryption at rest and in transit",
              "Multi-AZ regional replication for maximum redundancy",
              "Automated tiered storage lifecycle policies",
            ],
          },
        ],
      },
      {
        heading: "Architecture Overview",
        content:
          "Our high-performance architecture is built on a distributed mesh topology that ensures maximum redundancy and autonomous self-healing capabilities across a geo-distributed network. By decoupling our stateless logic layer from high-speed NVMe-over-Fabrics storage clusters, we enable rapid horizontal scaling and sub-50ms global latency through a proprietary edge synchronization protocol using Conflict-free Replicated Data Types (CRDTs). The entire ecosystem is secured by a zero-trust perimeter utilizing mutual TLS (mTLS) authentication and hardware-backed identity rotation, providing a resilient and technically precise foundation for modern enterprise-grade infrastructure.",
      },
      {
        heading: "Deployment Requirements",
        columns: [
          {
            subheading: "Network Topology",
            type: "list",
            items: [
              "BGP-based anycast routing across 12+ global PoPs",
              "DDoS mitigation with 10Tbps scrubbing capacity",
              "Private VPC peering with sub-1ms inter-service latency",
              "Automated DNS failover with 30s TTL propagation",
            ],
          },
          {
            subheading: "Observability Stack",
            type: "list",
            items: [
              "Prometheus + Grafana metrics pipeline",
              "OpenTelemetry distributed tracing (Jaeger backend)",
              "Centralized log aggregation via Loki / ELK",
              "PagerDuty incident escalation with auto-remediation runbooks",
            ],
          },
        ],
      },
    ],
  },

  "hardware-diagnostics": {
    icon: "memory",
    title: "Hardware Diagnostics",
    sections: [
      {
        heading: "Technical Specifications",
        columns: [
          {
            subheading: "Diagnostic Instruments",
            type: "paragraph",
            content:
              "We employ enterprise-grade diagnostic suites including IPMI/BMC telemetry, PCIe bus analyzers, and thermal imaging via FLIR-integrated probes. Memory integrity is validated through MemTest86+ extended patterns, while storage health is tracked via S.M.A.R.T. attribute monitoring with predictive failure analysis algorithms.",
          },
          {
            subheading: "Component Analysis",
            type: "list",
            items: [
              "CPU stress testing with Prime95 / Intel Burn Test",
              "GPU compute validation via CUDA/OpenCL benchmarks",
              "PSU ripple & voltage rail analysis with oscilloscope probes",
              "NIC throughput verification using iPerf3 bidirectional tests",
            ],
          },
        ],
      },
      {
        heading: "Architecture Overview",
        content:
          "Our hardware diagnostics platform operates on an agent-based telemetry architecture deployed across all managed nodes. Lightweight sensor daemons continuously stream CPU thermals, fan RPM, voltage rail stability, and disk I/O latency metrics to a centralized time-series database (InfluxDB) at 1-second granularity. Machine learning models trained on historical failure patterns perform predictive degradation analysis, issuing proactive replacement advisories 72–96 hours before component failure. All diagnostic data is correlated through a unified dashboard providing rack-level, node-level, and component-level drill-down visibility for operations teams.",
      },
      {
        heading: "Deployment Requirements",
        columns: [
          {
            subheading: "Supported Hardware",
            type: "list",
            items: [
              "x86_64 & ARM64 server platforms (Dell, HPE, Supermicro)",
              "NVMe, SAS, and SATA storage controllers",
              "InfiniBand HDR / 100GbE network adapters",
              "GPU accelerators (NVIDIA A100/H100, AMD MI300X)",
            ],
          },
          {
            subheading: "Reporting & Compliance",
            type: "list",
            items: [
              "Automated asset inventory with serial number tracking",
              "Warranty status validation and RMA workflow automation",
              "SOC 2 Type II audit-ready diagnostic logs",
              "Monthly health scorecards with trend analysis",
            ],
          },
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════
// MODAL HTML BUILDER
// ═══════════════════════════════════════════
function buildSectionContent(section) {
  let html = "";

  // Section heading
  html += `
    <div class="flex items-center gap-3 mb-6">
      <span class="w-1 h-6 bg-primary-container rounded-full"></span>
      <h3 class="font-headline-md text-headline-md text-on-surface">${section.heading}</h3>
    </div>`;

  // Two-column layout
  if (section.columns) {
    html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-8">`;
    for (const col of section.columns) {
      html += `<div class="space-y-4">`;
      html += `<h4 class="font-label-md text-primary-container uppercase tracking-widest">${col.subheading}</h4>`;

      if (col.type === "paragraph") {
        html += `<p class="font-body-md text-on-surface-variant leading-relaxed">${col.content}</p>`;
      } else if (col.type === "list") {
        html += `<ul class="list-disc list-inside space-y-2 mt-4 font-body-md text-on-surface-variant">`;
        for (const item of col.items) {
          html += `<li>${item}</li>`;
        }
        html += `</ul>`;
      }

      html += `</div>`;
    }
    html += `</div>`;
  }

  // Full-width paragraph (Architecture Overview style)
  if (section.content && !section.columns) {
    html += `<p class="font-body-md text-on-surface-variant leading-relaxed text-justify">${section.content}</p>`;
  }

  return html;
}

function buildServiceModal(serviceKey) {
  const data = serviceData[serviceKey];
  if (!data) return "";

  let sectionsHtml = "";
  for (const section of data.sections) {
    sectionsHtml += `<section class="space-y-6">${buildSectionContent(section)}</section>`;
  }

  return `
  <!-- Service Documentation Modal Overlay -->
  <div class="modal-overlay service-doc-modal" id="service-doc-modal">
    <!-- Modal Container -->
    <div class="modal-card w-full max-w-4xl bg-surface-container-low border border-outline-variant/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-8 py-6 border-b border-outline-variant/30 bg-surface-container-lowest">
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-lg bg-primary-container/10 border border-primary-container/30 flex items-center justify-center text-primary-container">
            <span class="material-symbols-outlined">${data.icon}</span>
          </div>
          <div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">${data.title}</h2>
            <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Service Documentation</p>
          </div>
        </div>
        <button class="service-modal-close text-on-surface-variant hover:text-on-surface transition-colors p-2 rounded-full hover:bg-surface-variant/50" id="service-modal-close-btn">
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      <!-- Modal Content (Scrollable) -->
      <div class="flex-1 overflow-y-auto px-8 py-10 space-y-12">
        ${sectionsHtml}
      </div>
      <!-- Modal Footer -->
      <div class="px-8 py-6 border-t border-outline-variant/30 bg-surface-container-lowest flex justify-end gap-4">
        <button class="service-modal-close px-8 py-3 rounded-lg border border-primary-container text-primary-container font-label-md hover:bg-primary-container/10 transition-all" onclick="window.print()">
          Print Specs
        </button>
        <button class="service-modal-close px-8 py-3 rounded-lg bg-secondary-container text-on-secondary-container font-label-md hover:brightness-110 transition-all" id="service-modal-footer-close">
          Close
        </button>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
// MODAL CONTROLLER
// ═══════════════════════════════════════════
let currentModal = null;

function openServiceModal(serviceKey) {
  // If a modal already exists, remove it
  const existing = document.getElementById("service-doc-modal");
  if (existing) existing.remove();

  // Get the modal root (shared with navbar modals)
  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return;

  // Inject the modal HTML
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildServiceModal(serviceKey);
  const modalEl = wrapper.firstElementChild;
  modalRoot.appendChild(modalEl);
  currentModal = modalEl;

  // Force reflow then open with animation
  void modalEl.offsetHeight;
  requestAnimationFrame(() => {
    modalEl.classList.add("open");
    document.body.style.overflow = "hidden";
  });

  // Wire close buttons
  modalEl.querySelectorAll(".service-modal-close").forEach((btn) => {
    btn.addEventListener("click", closeServiceModal);
  });

  // Backdrop click to close
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeServiceModal();
  });

  // Escape key to close
  document.addEventListener("keydown", handleEscape);
}

function closeServiceModal() {
  if (!currentModal) return;
  currentModal.classList.remove("open");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", handleEscape);

  // Remove from DOM after animation completes
  setTimeout(() => {
    if (currentModal) {
      currentModal.remove();
      currentModal = null;
    }
  }, 400);
}

function handleEscape(e) {
  if (e.key === "Escape") closeServiceModal();
}

// ═══════════════════════════════════════════
// WIRE UP SERVICE BUTTONS
// ═══════════════════════════════════════════
function initServiceModals() {
  const serviceButtons = document.querySelectorAll("[data-service-doc]");
  serviceButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const serviceKey = btn.getAttribute("data-service-doc");
      openServiceModal(serviceKey);
    });
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initServiceModals);
} else {
  initServiceModals();
}

export { openServiceModal, closeServiceModal };
