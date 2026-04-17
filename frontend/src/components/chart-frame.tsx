import { type ReactNode, useEffect, useRef, useState } from "react";

interface ChartFrameProps {
  children: (size: { width: number; height: number }) => ReactNode;
}

export function ChartFrame({ children }: ChartFrameProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="size-full min-h-0 min-w-0">
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
