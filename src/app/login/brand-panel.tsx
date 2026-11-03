"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "@/components/motion";

const WORDS = ["every order.", "every technician.", "every review.", "every ringgit."];

const WORD_MS = 4600;

export function BrandPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), WORD_MS);
    return () => clearInterval(t);
  }, []);

  const word = WORDS[tick % WORDS.length]!;

  return (
    <section className="relative hidden max-w-xl lg:block">
      <h1 className="text-[clamp(2.4rem,3.6vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-white">
        {"The control room for".split(" ").map((w, i) => (
          <motion.span
            key={w + i}
            className="mr-[0.25em] inline-block"
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.08 }}
          >
            {w}
          </motion.span>
        ))}
        <span className="relative block h-[1.15em] overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={word}
              className="absolute inset-x-0 bg-gradient-to-r from-sky-300 via-cyan-200 to-teal-200 bg-clip-text pb-1 text-transparent"
              initial={{ y: "90%", opacity: 0, filter: "blur(8px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={{ y: "-90%", opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.45 }}
        className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60"
      >
        Orders, dispatch, field completion, WhatsApp, manager review and KPIs — one governed system, with an AI layer that only answers
        from real data.
      </motion.p>
    </section>
  );
}
