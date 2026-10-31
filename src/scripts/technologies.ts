const section = document.querySelector<HTMLElement>('#technologies');

if (section) {
  const images = [...section.querySelectorAll<HTMLImageElement>('.technology-logo img')];
  const loadError = section.querySelector<HTMLElement>('.technologies-load-error')!;
  let loading: Promise<void> | undefined;
  const loadLogos = async () => {
    section.setAttribute('aria-busy', 'true');
    loadError.hidden = true;
    try {
      await Promise.all(images.map(image => {
        if (!image.getAttribute('src') || (image.complete && !image.naturalWidth)) image.src = image.dataset.src!;
        return image.decode();
      }));
      section.dataset.logosReady = 'true';
    } catch {
      // Keep the entire wall hidden if even one asset fails; never show broken/partial rows.
      loadError.hidden = false;
    } finally {
      section.removeAttribute('aria-busy');
    }
  };
  const startLoading = () => loading ??= loadLogos();
  section.querySelector('[data-retry-logos]')!.addEventListener('click', () => {
    loading = undefined;
    void startLoading();
  });
  // Finish the initial page render before preloading the complete logo wall.
  // The section stays hidden and paused until every copy has decoded.
  const preloadAfterHero = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => void startLoading(), { timeout: 1200 });
    else void startLoading();
  }));
  if (document.readyState === 'complete') preloadAfterHero();
  else window.addEventListener('load', preloadAfterHero, { once: true });
  const motionButton = section.querySelector<HTMLButtonElement>('.technologies-motion')!;
  const motionLabel = motionButton.querySelector<HTMLElement>('[data-motion-label]')!;
  const floatingTooltips = 'showPopover' in HTMLElement.prototype;
  section.dataset.floatingTooltips = String(floatingTooltips);
  let activeLogo: HTMLButtonElement | null = null;
  let positionActiveTooltip: (() => void) | null = null;
  let hideTooltipTimer: ReturnType<typeof setTimeout>;
  const hideTooltip = () => {
    if (!activeLogo) return;
    const tooltip = activeLogo.querySelector<HTMLElement>('.technology-tooltip')!;
    if (floatingTooltips && tooltip.matches(':popover-open')) tooltip.hidePopover();
    activeLogo = null;
    positionActiveTooltip = null;
  };
  motionButton.hidden = false;
  motionButton.addEventListener('click', () => {
    const paused = section.dataset.paused !== 'true';
    section.dataset.paused = String(paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionLabel.textContent = paused ? 'Resume animation' : 'Pause animation';
  });

  // Don't spend animation frames on a section outside the viewport.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      section.dataset.offscreen = String(!entry.isIntersecting);
      if (entry.isIntersecting) void startLoading();
    }).observe(section);
  } else {
    section.dataset.offscreen = 'false';
  }

  section.querySelectorAll<HTMLElement>('.technology-row').forEach(row => {
    row.addEventListener('scroll', () => {
      if (activeLogo && row.contains(activeLogo)) positionActiveTooltip?.();
    }, { passive: true });
    row.addEventListener('focusin', event => {
      const logo = event.target;
      if (!(logo instanceof HTMLButtonElement) || !logo.matches(':focus-visible')) return;
      row.dataset.keyboard = 'true';
      logo.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
    });
    row.addEventListener('focusout', event => {
      if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
      delete row.dataset.keyboard;
      row.scrollLeft = 0;
    });
    // Keep tooltips within the visible strip, including when a logo is near an edge.
    row.querySelectorAll<HTMLButtonElement>('.technology-logo').forEach(logo => {
      const tooltip = logo.querySelector<HTMLElement>('.technology-tooltip')!;
      if (floatingTooltips) tooltip.setAttribute('popover', 'manual');
      const positionTooltip = () => {
        const bounds = row.getBoundingClientRect();
        const buttonBounds = logo.getBoundingClientRect();
        const halfWidth = tooltip.offsetWidth / 2;
        const edge = bounds.width * .04 + 8;
        const center = Math.max(bounds.left + halfWidth + edge, Math.min(buttonBounds.left + buttonBounds.width / 2, bounds.right - halfWidth - edge));
        tooltip.style.left = `${floatingTooltips ? center : center - buttonBounds.left}px`;
        if (floatingTooltips) {
          // Popovers live in the browser's top layer, outside the scrolling track's transform.
          tooltip.style.left = `${center - halfWidth}px`;
          const below = buttonBounds.bottom + 3;
          tooltip.style.top = `${below + tooltip.offsetHeight <= innerHeight - 8 ? below : buttonBounds.top - tooltip.offsetHeight - 8}px`;
        }
      };
      const showTooltip = () => {
        clearTimeout(hideTooltipTimer);
        if (activeLogo !== logo) hideTooltip();
        activeLogo = logo;
        positionActiveTooltip = positionTooltip;
        delete logo.dataset.tooltipDismissed;
        if (floatingTooltips && !tooltip.matches(':popover-open')) tooltip.showPopover();
        positionTooltip();
      };
      const hideWhenIdle = () => {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = setTimeout(() => {
          if (activeLogo === logo && !logo.matches(':hover, :focus') && !tooltip.matches(':hover')) hideTooltip();
        }, 100);
      };
      logo.addEventListener('pointerenter', showTooltip);
      logo.addEventListener('pointerleave', hideWhenIdle);
      tooltip.addEventListener('pointerenter', () => clearTimeout(hideTooltipTimer));
      tooltip.addEventListener('pointerleave', hideWhenIdle);
      logo.addEventListener('focus', () => {
        requestAnimationFrame(showTooltip);
      });
      logo.addEventListener('blur', hideWhenIdle);
      // A tap holds the name and pauses its row through :focus-within.
      logo.addEventListener('click', () => logo.focus({ preventScroll: true }));
    });
  });

  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Element && !event.target.closest('.technology-logo') && document.activeElement instanceof HTMLButtonElement && document.activeElement.matches('.technology-logo')) {
      document.activeElement.blur();
      hideTooltip();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      section.querySelectorAll<HTMLElement>('.technology-logo:is(:hover, :focus)').forEach(logo => {
        logo.dataset.tooltipDismissed = 'true';
      });
      hideTooltip();
    }
  });
  window.addEventListener('scroll', hideTooltip, { passive: true });
  window.addEventListener('resize', hideTooltip, { passive: true });
}
