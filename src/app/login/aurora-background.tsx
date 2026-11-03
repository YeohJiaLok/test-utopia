"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

type Particle = { x: number; y: number; life: number; max: number; speed: number; hue: number; light: number };

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Full-bleed animated backdrop for the login screen: drifting aurora light, an "airflow" particle
 * field (cool air currents streaming left → right, parting around the cursor), a flowing
 * perspective grid, a cursor spotlight and film grain. Canvas work is capped at 2× DPR and a
 * particle budget scaled to the viewport; prefers-reduced-motion renders a single static frame.
 */
export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999 };
    let w = 0;
    let h = 0;
    let raf = 0;
    let particles: Particle[] = [];

    const spawn = (fromEdge: boolean): Particle => ({
      x: fromEdge ? -20 + Math.random() * w * 0.15 : Math.random() * w,
      y: Math.random() * h,
      life: 0,
      max: 220 + Math.random() * 320,
      speed: 0.45 + Math.random() * 1.1,
      hue: Math.random() < 0.82 ? 190 + Math.random() * 30 : 250 + Math.random() * 20,
      light: 62 + Math.random() * 22,
    });

    // Smooth pseudo flow field: mostly rightward air with gentle swirls that evolve over time.
    const angle = (x: number, y: number, t: number) =>
      0.12 +
      0.95 * Math.sin(x * 0.0026 + t * 0.00021) * Math.cos(y * 0.0031 - t * 0.00017) +
      0.45 * Math.sin((x - y) * 0.0014 + t * 0.00013);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const budget = Math.min(260, Math.round((w * h) / 6500));
      particles = Array.from({ length: budget }, () => spawn(false));
      particles.forEach((p) => (p.life = Math.random() * p.max));
    }

    function frame(t: number) {
      // Fade previous strokes to transparent so trails dissolve over the CSS aurora beneath.
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.fillStyle = "rgba(0,0,0,0.09)";
      ctx!.fillRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineWidth = 1.1;
      ctx!.lineCap = "round";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const a = angle(p.x, p.y, t);
        let nx = p.x + Math.cos(a) * p.speed;
        let ny = p.y + Math.sin(a) * p.speed;

        const dx = nx - pointer.x;
        const dy = ny - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 170 * 170) {
          const d = Math.sqrt(d2) || 1;
          const push = (1 - d / 170) * 2.4;
          nx += (dx / d) * push;
          ny += (dy / d) * push;
        }

        const fade = Math.sin((p.life / p.max) * Math.PI);
        ctx!.strokeStyle = `hsla(${p.hue}, 95%, ${p.light}%, ${0.38 * fade})`;
        ctx!.beginPath();
        ctx!.moveTo(p.x, p.y);
        ctx!.lineTo(nx, ny);
        ctx!.stroke();

        p.x = nx;
        p.y = ny;
        p.life++;
        if (p.life > p.max || p.x > w + 20 || p.y < -20 || p.y > h + 20) particles[i] = spawn(true);
      }
      raf = requestAnimationFrame(frame);
    }

    function staticFrame() {
      for (const p of particles) {
        ctx!.fillStyle = `hsla(${p.hue}, 90%, ${p.light}%, 0.35)`;
        ctx!.fillRect(p.x, p.y, 1.4, 1.4);
      }
    }

    function onPointer(e: PointerEvent) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      spotRef.current?.style.setProperty("--x", `${e.clientX}px`);
      spotRef.current?.style.setProperty("--y", `${e.clientY}px`);
    }
    function onLeave() {
      pointer.x = pointer.y = -9999;
    }

    resize();
    if (reduce) staticFrame();
    else raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) staticFrame();
    });
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Aurora light */}
      <motion.div
        className="absolute -top-[30%] -left-[15%] size-[70vmax] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.17_245/0.45),transparent_60%)] blur-3xl"
        animate={{ x: ["0%", "12%", "-4%", "0%"], y: ["0%", "8%", "14%", "0%"], scale: [1, 1.12, 0.95, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[20%] -bottom-[35%] size-[65vmax] rounded-full bg-[radial-gradient(circle,oklch(0.72_0.13_200/0.32),transparent_60%)] blur-3xl"
        animate={{ x: ["0%", "-10%", "6%", "0%"], y: ["0%", "-12%", "-4%", "0%"], scale: [1, 0.92, 1.1, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] left-[40%] size-[45vmax] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.2_285/0.22),transparent_62%)] blur-3xl"
        animate={{ x: ["0%", "-18%", "10%", "0%"], y: ["0%", "10%", "-8%", "0%"] }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Flowing perspective grid floor */}
      <div className="absolute inset-x-[-25%] bottom-0 h-[55%] [perspective:700px]">
        <div className="grid-floor absolute inset-0 origin-bottom [transform:rotateX(62deg)] [mask-image:linear-gradient(to_top,black_10%,transparent_75%)]" />
      </div>
      {/* Fine top grid */}
      <div className="bg-grid absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_55%_at_30%_0%,black,transparent)]" />

      {/* Airflow particles */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />

      {/* Cursor spotlight */}
      <div
        ref={spotRef}
        className="absolute inset-0 [background:radial-gradient(520px_circle_at_var(--x,50%)_var(--y,40%),oklch(0.75_0.13_220/0.10),transparent_45%)]"
      />

      {/* Vignette + grain */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,oklch(0.09_0.02_258/0.85))]" />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
