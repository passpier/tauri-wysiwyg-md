import { useEffect, useRef, useState } from 'react';

interface LayoutMetrics {
  viewportWidth: number;
  viewportHeight: number;
  availableWidth: number;
  availableHeight: number;
  contentWidth: number;
  horizontalPadding: number;
  verticalPadding: number;
  hasVerticalScrollbar: boolean;
  hasHorizontalScrollbar: boolean;
  optimalLineLength: number;
}

/**
 * Hook for calculating editor layout metrics and responsive sizing.
 * Measures viewport, accounts for scrollbars, and calculates optimal content width.
 */
export function useEditorLayout(containerRef: React.RefObject<HTMLDivElement>) {
  const [metrics, setMetrics] = useState<LayoutMetrics>({
    viewportWidth: 0,
    viewportHeight: 0,
    availableWidth: 0,
    availableHeight: 0,
    contentWidth: 0,
    horizontalPadding: 16, // px-4 = 8px * 2
    verticalPadding: 24, // py-6 = 6 * 4px = 24px
    hasVerticalScrollbar: false,
    hasHorizontalScrollbar: false,
    optimalLineLength: 0,
  });

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const calculateMetrics = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const viewportWidth = container.clientWidth;
      const viewportHeight = container.clientHeight;

      // Detect scrollbars
      const hasVerticalScrollbar = container.scrollHeight > container.clientHeight;
      const hasHorizontalScrollbar = container.scrollWidth > container.clientWidth;

      // Account for scrollbar width (typically 15px on most browsers)
      const scrollbarWidth = hasVerticalScrollbar ? 15 : 0;

      // Calculate available width after accounting for padding and scrollbars
      const horizontalPadding = 16; // px-4 = 8px * 2
      const availableWidth = viewportWidth - horizontalPadding - scrollbarWidth;

      // Calculate available height after padding
      const verticalPadding = 24; // py-6 = 6 * 4px
      const availableHeight = viewportHeight - verticalPadding;

      // Determine optimal content width
      // For readability, aim for 65-75 characters per line (approximately 600-800px)
      // Start with available width, cap at max-w-4xl (1024px)
      const maxContentWidth = 1024; // max-w-4xl
      const contentWidth = Math.min(availableWidth, maxContentWidth);

      // Calculate optimal line length for better readability
      // Assuming average character width of ~8-10px for prose text
      const avgCharWidth = 9;
      const optimalLineLength = Math.round(contentWidth / avgCharWidth);

      setMetrics({
        viewportWidth,
        viewportHeight,
        availableWidth,
        availableHeight,
        contentWidth,
        horizontalPadding,
        verticalPadding,
        hasVerticalScrollbar,
        hasHorizontalScrollbar,
        optimalLineLength,
      });
    };

    // Debounce calculation to avoid excessive recalculations
    const debouncedCalculate = () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
      measureTimeoutRef.current = setTimeout(calculateMetrics, 100);
    };

    // Initial calculation
    calculateMetrics();

    // Set up ResizeObserver for container changes
    resizeObserverRef.current = new ResizeObserver(debouncedCalculate);
    if (containerRef.current) {
      resizeObserverRef.current.observe(containerRef.current);
    }

    // Listen for window resize events
    window.addEventListener('resize', debouncedCalculate);

    return () => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', debouncedCalculate);
    };
  }, [containerRef]);

  return metrics;
}
