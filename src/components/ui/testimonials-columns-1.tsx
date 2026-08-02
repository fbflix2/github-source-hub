import React from "react";
import { motion } from "motion/react";

export type Testimonial = {
  text: string;
  image: string;
  name: string;
  role: string;
};

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration ?? 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[0, 1].map((dup) => (
          <React.Fragment key={dup}>
            {props.testimonials.map(({ text, image, name, role }, i) => (
              <div
                className="w-full max-w-xs rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm"
                key={`${dup}-${i}`}
              >
                <p className="text-[14.5px] leading-relaxed text-white/70">{text}</p>
                <div className="mt-5 flex items-center gap-3">
                  <img
                    src={image}
                    alt={name}
                    loading="lazy"
                    width={40}
                    height={40}
                    className="size-10 rounded-full border border-white/10 object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-medium leading-5 tracking-tight text-white">
                      {name}
                    </span>
                    <span className="text-[12.5px] leading-5 text-white/45">{role}</span>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
