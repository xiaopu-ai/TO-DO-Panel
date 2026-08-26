(function initNativeIconMotion() {
  const interactiveSelector = 'button, [role="button"], a, .icon-button';

  function prepare(root) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const elements = [];
    if (scope instanceof Element && scope.matches(interactiveSelector)) elements.push(scope);
    elements.push(...scope.querySelectorAll(interactiveSelector));
    elements.forEach((element) => {
      const svg = element.querySelector(':scope > svg, :scope svg');
      if (!svg || element.dataset.iconMotionReady === 'true') return;
      element.dataset.iconMotionReady = 'true';
      element.classList.add('motion-icon');
      svg.classList.add('lucide-motion');
      svg.querySelectorAll('path, line, polyline, circle, rect').forEach((shape) => {
        if (shape.getAttribute('fill') === 'none' || !shape.getAttribute('fill')) {
          shape.setAttribute('pathLength', '1');
        }
      });
    });
  }

  document.addEventListener('pointerover', (event) => {
    const target = event.target.closest?.('[data-icon-motion-ready="true"]');
    if (target) target.classList.add('motion-active');
  });
  document.addEventListener('pointerout', (event) => {
    const target = event.target.closest?.('[data-icon-motion-ready="true"]');
    if (target && !target.contains(event.relatedTarget)) target.classList.remove('motion-active');
  });
  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-icon-motion-ready="true"]');
    if (!target) return;
    target.classList.remove('motion-tap');
    void target.offsetWidth;
    target.classList.add('motion-tap');
    setTimeout(() => target.classList.remove('motion-tap'), 360);
  });

  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) prepare(node);
    }));
  });
  prepare(document);
  observer.observe(document.body, { childList: true, subtree: true });
})();
