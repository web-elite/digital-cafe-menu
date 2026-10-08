import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Category } from "../lib/menuData";
import { faNumber } from "../lib/menuData";

type Props = {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  getHref?: (id: string) => string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function CategoryRibbon({ categories, selectedId, onSelect, getHref }: Props) {
  const ribbonRef = useRef<HTMLElement>(null);
  const scrollbarRef = useRef<HTMLInputElement>(null);
  const motionRef = useRef({ frame: 0, target: 0, mode: "" });
  const dragRef = useRef({ active: false, moved: false, pointerId: -1, startX: 0, startScroll: 0, lastScroll: 0, lastTime: 0, velocity: 0 });
  const [dragging, setDragging] = useState(false);
  const [metrics, setMetrics] = useState({ progress: 0, thumbWidth: 48, overflow: false });

  const stopMotion = () => {
    cancelAnimationFrame(motionRef.current.frame);
    motionRef.current.frame = 0;
    motionRef.current.mode = "";
  };

  useEffect(() => {
    const ribbon = ribbonRef.current;
    const scrollbar = scrollbarRef.current;
    if (!ribbon || !scrollbar) return;

    const measure = () => {
      const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
      const progress = max > 0 ? clamp(-ribbon.scrollLeft / max, 0, 1) * 1000 : 0;
      const ratio = ribbon.scrollWidth ? ribbon.clientWidth / ribbon.scrollWidth : 1;
      setMetrics({ progress, thumbWidth: Math.min(scrollbar.clientWidth, Math.max(36, scrollbar.clientWidth * ratio)), overflow: max > 2 });
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const max = ribbon.scrollWidth - ribbon.clientWidth;
      if (max <= 0) return;
      const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? ribbon.clientWidth : 1;
      const current = motionRef.current.mode === "wheel" ? motionRef.current.target : -ribbon.scrollLeft;
      const target = clamp(current + event.deltaY * factor, 0, max);
      if (Math.abs(target - current) < .5) return;
      event.preventDefault();

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        ribbon.scrollLeft = -target;
        return;
      }

      if (motionRef.current.mode !== "wheel") stopMotion();
      motionRef.current.mode = "wheel";
      motionRef.current.target = target;
      if (motionRef.current.frame) return;
      let previousTime = performance.now();
      const tick = (now: number) => {
        const elapsed = clamp(now - previousTime, 1, 40);
        previousTime = now;
        const offset = -ribbon.scrollLeft;
        const difference = motionRef.current.target - offset;
        if (Math.abs(difference) < .5) {
          ribbon.scrollLeft = -motionRef.current.target;
          motionRef.current.frame = 0;
          motionRef.current.mode = "";
          return;
        }
        // Use one accumulated target so fast wheel gestures never cancel each other.
        const previousScroll = ribbon.scrollLeft;
        ribbon.scrollLeft = -(offset + difference * (1 - Math.exp(-elapsed / 65)));
        if (Math.abs(ribbon.scrollLeft - previousScroll) < .01) {
          ribbon.scrollLeft = -motionRef.current.target;
          motionRef.current.frame = 0;
          motionRef.current.mode = "";
          return;
        }
        motionRef.current.frame = requestAnimationFrame(tick);
      };
      motionRef.current.frame = requestAnimationFrame(tick);
    };

    ribbon.addEventListener("scroll", measure, { passive: true });
    ribbon.addEventListener("wheel", onWheel, { passive: false });
    const observer = new ResizeObserver(measure);
    observer.observe(ribbon);
    observer.observe(scrollbar);
    measure();
    return () => {
      ribbon.removeEventListener("scroll", measure);
      ribbon.removeEventListener("wheel", onWheel);
      observer.disconnect();
      stopMotion();
    };
  }, [categories.length]);

  useEffect(() => {
    const ribbon = ribbonRef.current;
    const selected = ribbon?.querySelector<HTMLElement>("[aria-current='true']");
    if (!ribbon || !selected) return;
    stopMotion();
    const frame = requestAnimationFrame(() => {
      const outer = ribbon.getBoundingClientRect();
      const inner = selected.getBoundingClientRect();
      const delta = inner.left + inner.width / 2 - outer.left - outer.width / 2;
      const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
      ribbon.scrollTo({ left: clamp(ribbon.scrollLeft + delta, -max, 0), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, categories]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    stopMotion();
    dragRef.current.moved = false;
    dragRef.current.active = false;
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const ribbon = event.currentTarget;
    dragRef.current = { active: true, moved: false, pointerId: event.pointerId, startX: event.clientX, startScroll: ribbon.scrollLeft, lastScroll: ribbon.scrollLeft, lastTime: performance.now(), velocity: 0 };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(delta) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    event.preventDefault();
    const ribbon = event.currentTarget;
    const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
    const next = clamp(drag.startScroll - delta, -max, 0);
    const now = performance.now();
    const elapsed = Math.max(8, now - drag.lastTime);
    drag.velocity = drag.velocity * .4 + ((next - drag.lastScroll) / elapsed) * .6;
    drag.lastScroll = next;
    drag.lastTime = now;
    ribbon.scrollLeft = next;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    setDragging(false);
    const ribbon = event.currentTarget;
    if (ribbon.hasPointerCapture(event.pointerId)) ribbon.releasePointerCapture(event.pointerId);
    if (cancelled || !drag.moved || performance.now() - drag.lastTime > 100 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let velocity = clamp(drag.velocity, -2.6, 2.6);
    let previousTime = performance.now();
    motionRef.current.mode = "drag";
    const tick = (now: number) => {
      const elapsed = clamp(now - previousTime, 1, 32);
      previousTime = now;
      const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
      const current = ribbon.scrollLeft;
      const next = clamp(current + velocity * elapsed, -max, 0);
      ribbon.scrollLeft = next;
      velocity *= Math.pow(.91, elapsed / 16);
      if (Math.abs(velocity) < .025 || next === current) {
        motionRef.current.frame = 0;
        motionRef.current.mode = "";
        return;
      }
      motionRef.current.frame = requestAnimationFrame(tick);
    };
    motionRef.current.frame = requestAnimationFrame(tick);
  };

  return (
    <div className="category-scroller">
      <nav
        id="menu-category-ribbon"
        className={`category-ribbon${dragging ? " is-dragging" : ""}`}
        aria-label="دسته‌بندی‌های منو؛ با لمس یا کشیدن موس ورق بزنید"
        ref={ribbonRef}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => finishDrag(event)}
        onPointerCancel={(event) => finishDrag(event, true)}
        onPointerLeave={(event) => { if (dragRef.current.active && !dragRef.current.moved) finishDrag(event, true); }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (!dragRef.current.moved || event.detail === 0) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const ribbon = event.currentTarget;
          const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
          const offsets: Record<string, number> = { ArrowLeft: ribbon.scrollLeft - 210, ArrowRight: ribbon.scrollLeft + 210, Home: 0, End: -max };
          if (!(event.key in offsets)) return;
          event.preventDefault();
          stopMotion();
          ribbon.scrollTo({ left: clamp(offsets[event.key], -max, 0), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        }}
      >
        {categories.map((category) => (
          <a
            key={category.id}
            href={getHref ? getHref(category.id) : `#/category/${encodeURIComponent(category.id)}`}
            className={`category-visual${selectedId === category.id ? " is-selected" : ""}`}
            aria-current={selectedId === category.id ? "true" : undefined}
            style={{ backgroundImage: `linear-gradient(90deg, rgba(10,12,11,.07), rgba(9,10,9,.72)), url("${category.cover}")` }}
            onClick={(event) => {
              if (event.ctrlKey || event.metaKey || event.shiftKey) return;
              event.preventDefault();
              onSelect(category.id);
            }}
          >
            <span>{category.title}</span>
          </a>
        ))}
      </nav>
      <div className={`category-scrollbar${metrics.overflow ? " has-overflow" : ""}`}>
        <input
          ref={scrollbarRef}
          type="range"
          min="0"
          max="1000"
          step="1"
          value={metrics.progress}
          disabled={!metrics.overflow}
          aria-controls="menu-category-ribbon"
          aria-label="اسکرول دسته‌بندی‌ها"
          aria-valuetext={`${faNumber(Math.round(metrics.progress / 10))} درصد`}
          style={{ "--scroll-thumb-width": `${metrics.thumbWidth}px` } as CSSProperties}
          onPointerDown={stopMotion}
          onChange={(event) => {
            const ribbon = ribbonRef.current;
            if (!ribbon) return;
            stopMotion();
            const max = Math.max(0, ribbon.scrollWidth - ribbon.clientWidth);
            const progress = Number(event.target.value);
            setMetrics((current) => ({ ...current, progress }));
            ribbon.scrollLeft = -max * progress / 1000;
          }}
        />
      </div>
    </div>
  );
}