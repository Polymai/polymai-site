(function () {
  const root = window.Polymai || {};
  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEWBOX = { width: 900, height: 760, cx: 450, cy: 380 };
  const SEGMENT_GAP = 7;
  const SEGMENT_SPAN = 360 / 6;

  const steps = [
    {
      id: "describe",
      number: "01",
      label: "Describe",
      title: "Tell Polymai what to build",
      summary: "Describe the app, users, workflow, data, services, and outcome.",
      artifact: "Build brief",
      detail: "This gives the builder a stable product target before any code is produced.",
      colors: ["#dff7ee", "#7bd6b8"],
      accent: "#08785f",
    },
    {
      id: "scope",
      number: "02",
      label: "Scope",
      title: "Review the plan",
      summary: "Confirm the work surface, constraints, and service boundaries.",
      artifact: "Scoped file plan",
      detail: "The implementation starts from a bounded change plan instead of a broad rewrite.",
      colors: ["#e8f5ff", "#87c7f5"],
      accent: "#1d6f9f",
    },
    {
      id: "build",
      number: "03",
      label: "Build",
      title: "Generate the app",
      summary: "Run Polymai or Codex from the prepared task.",
      artifact: "Focused code diff",
      detail: "The generated files follow the app contract and keep service work server-side.",
      colors: ["#f2ecff", "#b8a3ef"],
      accent: "#6752b8",
    },
    {
      id: "preview",
      number: "04",
      label: "Preview",
      title: "Inspect the result",
      summary: "Open the running app and verify what the browser renders.",
      artifact: "Screenshot evidence",
      detail: "Visual review catches blank states, clipping, overlap, and broken media early.",
      colors: ["#fff4d8", "#efc06d"],
      accent: "#9a6812",
    },
    {
      id: "check",
      number: "05",
      label: "Check",
      title: "Verify readiness",
      summary: "Surface missing data, email, payment, publishing, and smoke-test setup.",
      artifact: "Readiness report",
      detail: "Provisioning and runtime checks stay connected to the app files.",
      colors: ["#ffe8df", "#efa188"],
      accent: "#a84f32",
    },
    {
      id: "iterate",
      number: "06",
      label: "Iterate",
      title: "Request the next change",
      summary: "Ask for a focused update against the current app context.",
      artifact: "Preserved project state",
      detail: "Future changes reuse the same app memory, registry, and constraints.",
      colors: ["#edf8e6", "#a8d77a"],
      accent: "#527f2b",
    },
  ];

  function svgEl(tag, attributes) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function htmlEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function polarPoint(cx, cy, radius, angle) {
    const radians = (angle - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  function arcPath(cx, cy, radius, startAngle, endAngle, sweep = 1) {
    const start = polarPoint(cx, cy, radius, startAngle);
    const end = polarPoint(cx, cy, radius, endAngle);
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
  }

  function segmentPath(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
    const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
    const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
    const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
    const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
      `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
      "Z",
    ].join(" ");
  }

  function clearElement(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function appendText(parent, tag, className, text) {
    const element = htmlEl(tag, className, text);
    parent.appendChild(element);
    return element;
  }

  function createDefs(svg) {
    const defs = svgEl("defs");
    const radial = svgEl("radialGradient", {
      id: "flowRadial",
      cx: "50%",
      cy: "45%",
      r: "56%",
    });
    [
      ["0%", "flow-radial-stop-core", "rgba(214,242,232,0.58)"],
      ["58%", "flow-radial-stop-mid", "rgba(158,211,194,0.28)"],
      ["100%", "flow-radial-stop-edge", "rgba(15,143,104,0)"],
    ].forEach(([offset, className, color]) => {
      radial.appendChild(svgEl("stop", { offset, class: className, "stop-color": color }));
    });
    defs.appendChild(radial);

    const glow = svgEl("filter", {
      id: "flowGlow",
      x: "-30%",
      y: "-30%",
      width: "160%",
      height: "160%",
      colorInterpolationFilters: "sRGB",
    });
    glow.appendChild(svgEl("feGaussianBlur", { in: "SourceAlpha", stdDeviation: "7", result: "blur" }));
    glow.appendChild(svgEl("feOffset", { dx: "0", dy: "12", result: "offset" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "offset" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    glow.appendChild(merge);
    defs.appendChild(glow);

    steps.forEach((step, index) => {
      const marker = svgEl("marker", {
        id: `flowArrow-${step.id}`,
        markerWidth: "9",
        markerHeight: "9",
        refX: "7",
        refY: "4.5",
        orient: "auto",
        markerUnits: "strokeWidth",
      });
      marker.appendChild(svgEl("path", {
        d: "M 0 0 L 8 4.5 L 0 9 Z",
        fill: step.accent,
      }));
      defs.appendChild(marker);

      const gradient = svgEl("linearGradient", {
        id: `flowGradient-${step.id}`,
        x1: "0%",
        y1: "0%",
        x2: "100%",
        y2: "100%",
      });
      gradient.appendChild(svgEl("stop", { offset: "0%", "stop-color": step.colors[0] }));
      gradient.appendChild(svgEl("stop", { offset: "100%", "stop-color": step.colors[1] }));
      defs.appendChild(gradient);

      const centerAngle = index * SEGMENT_SPAN;
      const start = centerAngle - (SEGMENT_SPAN - SEGMENT_GAP) / 2 + 7;
      const end = centerAngle + (SEGMENT_SPAN - SEGMENT_GAP) / 2 - 7;
      const lowerHalf = centerAngle > 90 && centerAngle < 270;
      const labelPath = svgEl("path", {
        id: `flowLabelPath-${step.id}`,
        d: lowerHalf
          ? arcPath(VIEWBOX.cx, VIEWBOX.cy, 278, end, start, 0)
          : arcPath(VIEWBOX.cx, VIEWBOX.cy, 278, start, end, 1),
      });
      defs.appendChild(labelPath);
    });

    svg.appendChild(defs);
  }

  function renderSvg(svg) {
    clearElement(svg);
    createDefs(svg);

    const backgroundGroup = svgEl("g", { class: "flow-svg-background", "aria-hidden": "true" });
    backgroundGroup.appendChild(svgEl("circle", {
      cx: VIEWBOX.cx,
      cy: VIEWBOX.cy,
      r: "318",
      fill: "url(#flowRadial)",
      class: "flow-bg-disc",
    }));
    backgroundGroup.appendChild(svgEl("circle", {
      cx: VIEWBOX.cx,
      cy: VIEWBOX.cy,
      r: "285",
      fill: "none",
      class: "flow-grid-ring",
    }));
    backgroundGroup.appendChild(svgEl("circle", {
      cx: VIEWBOX.cx,
      cy: VIEWBOX.cy,
      r: "174",
      fill: "none",
      class: "flow-inner-ring",
    }));
    svg.appendChild(backgroundGroup);

    const connectorGroup = svgEl("g", { class: "flow-connectors", "aria-hidden": "true" });
    const segmentGroup = svgEl("g", { class: "flow-segments" });
    const labelGroup = svgEl("g", { class: "flow-svg-labels", "aria-hidden": "true" });

    steps.forEach((step, index) => {
      const centerAngle = index * SEGMENT_SPAN;
      const start = centerAngle - (SEGMENT_SPAN - SEGMENT_GAP) / 2;
      const end = centerAngle + (SEGMENT_SPAN - SEGMENT_GAP) / 2;
      const nextStart = (index + 1) * SEGMENT_SPAN - (SEGMENT_SPAN - SEGMENT_GAP) / 2;
      const connector = svgEl("path", {
        d: arcPath(VIEWBOX.cx, VIEWBOX.cy, 336, end + 1.3, nextStart - 1.3, 1),
        class: "flow-connector",
        stroke: step.accent,
        "data-flow-id": step.id,
        "marker-end": `url(#flowArrow-${step.id})`,
        style: `--flow-index:${index}`,
      });
      connectorGroup.appendChild(connector);

      const path = svgEl("path", {
        d: segmentPath(VIEWBOX.cx, VIEWBOX.cy, 238, 322, start, end),
        fill: `url(#flowGradient-${step.id})`,
        class: "flow-segment",
        "data-flow-id": step.id,
        filter: "url(#flowGlow)",
        style: `--flow-index:${index}`,
      });
      segmentGroup.appendChild(path);

      const text = svgEl("text", {
        class: "flow-segment-label",
      });
      const textPath = svgEl("textPath", {
        href: `#flowLabelPath-${step.id}`,
        startOffset: "50%",
        "text-anchor": "middle",
      });
      textPath.textContent = `${step.number} ${step.label}`;
      text.appendChild(textPath);
      labelGroup.appendChild(text);
    });

    svg.appendChild(connectorGroup);
    svg.appendChild(segmentGroup);
    svg.appendChild(labelGroup);
  }

  function getNextStep(step) {
    const index = steps.findIndex((candidate) => candidate.id === step.id);
    return steps[(index + 1 + steps.length) % steps.length];
  }

  function renderCenter(center, step) {
    const nextStep = getNextStep(step);
    clearElement(center);
    center.style.setProperty("--flow-step-color", step.accent);
    appendText(center, "span", "flow-center-kicker", "Selected step");
    appendText(center, "strong", "flow-center-title", `${step.number} ${step.label}`);
    appendText(center, "p", "flow-center-heading", step.title);
    appendText(center, "p", "flow-center-summary", step.summary);
    const meta = htmlEl("div", "flow-center-meta");
    appendText(meta, "small", "flow-center-artifact", step.artifact);
    appendText(meta, "small", "flow-center-next", `Next: ${nextStep.number} ${nextStep.label}`);
    center.appendChild(meta);
  }

  function createHotspots(container) {
    clearElement(container);
    return steps.map((step, index) => {
      const centerAngle = index * SEGMENT_SPAN;
      const point = polarPoint(VIEWBOX.cx, VIEWBOX.cy, 332, centerAngle);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flow-step-button";
      button.dataset.flowId = step.id;
      button.style.left = `${(point.x / VIEWBOX.width) * 100}%`;
      button.style.top = `${(point.y / VIEWBOX.height) * 100}%`;
      button.style.setProperty("--flow-index", index);
      button.style.setProperty("--flow-step-color", step.accent);
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `${step.number} ${step.label}: ${step.title}. Developer artifact: ${step.artifact}.`);
      button.innerHTML = [
        `<span>${step.number}</span>`,
        `<strong>${step.label}</strong>`,
      ].join("");
      container.appendChild(button);
      return button;
    });
  }

  function initBuildFlow() {
    const component = document.getElementById("buildFlowComponent");
    if (!component) return;

    const canvas = component.querySelector("[data-flow-canvas]");
    const svg = component.querySelector("[data-flow-svg]");
    const hotspotsContainer = component.querySelector("[data-flow-hotspots]");
    const center = component.querySelector("[data-flow-center]");
    if (!canvas || !svg || !hotspotsContainer || !center) return;

    renderSvg(svg);
    const buttons = createHotspots(hotspotsContainer);
    const segments = Array.from(svg.querySelectorAll(".flow-segment"));
    const connectors = Array.from(svg.querySelectorAll(".flow-connector"));
    let activeIndex = 0;

    function getStepById(id) {
      return steps.find((step) => step.id === id) || steps[0];
    }

    function setActive(id, focusButton = false) {
      const step = getStepById(id);
      activeIndex = steps.findIndex((candidate) => candidate.id === step.id);
      component.dataset.activeFlow = step.id;
      segments.forEach((segment) => {
        segment.classList.toggle("is-active", segment.dataset.flowId === step.id);
      });
      connectors.forEach((connector) => {
        connector.classList.toggle("is-active", connector.dataset.flowId === step.id);
      });
      buttons.forEach((button) => {
        const isActive = button.dataset.flowId === step.id;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
        if (isActive && focusButton) button.focus();
      });
      renderCenter(center, step);
    }

    function moveFocus(delta) {
      const nextIndex = (activeIndex + delta + steps.length) % steps.length;
      setActive(steps[nextIndex].id, true);
    }

    buttons.forEach((button) => {
      button.addEventListener("mouseenter", () => {
        setActive(button.dataset.flowId);
      });
      button.addEventListener("focus", () => {
        setActive(button.dataset.flowId);
      });
      button.addEventListener("click", () => {
        setActive(button.dataset.flowId);
        component.classList.add("has-clicked-step");
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
        }
        if (event.key === "Home") {
          event.preventDefault();
          setActive(steps[0].id, true);
        }
        if (event.key === "End") {
          event.preventDefault();
          setActive(steps[steps.length - 1].id, true);
        }
      });
    });

    segments.forEach((segment) => {
      segment.addEventListener("mouseenter", () => {
        setActive(segment.dataset.flowId);
      });
      segment.addEventListener("click", () => setActive(segment.dataset.flowId));
    });

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(([entry]) => {
        const width = entry.contentRect.width || canvas.clientWidth;
        canvas.style.setProperty("--flow-scale", Math.min(width / 820, 1).toFixed(3));
        component.classList.toggle("is-flow-compact", width < 560);
      });
      observer.observe(canvas);
    }

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            component.classList.add("is-flow-visible");
            observer.disconnect();
          }
        });
      }, { threshold: 0.32 });
      observer.observe(component);
    } else {
      component.classList.add("is-flow-visible");
    }

    setActive(steps[0].id);
  }

  root.buildFlow = {
    initBuildFlow,
  };

  window.Polymai = root;
})();
