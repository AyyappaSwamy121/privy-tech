import React from 'react';
import { motion } from 'framer-motion';
import { useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const ParallaxBackground = ({ children, speed = 0.5 }) => {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start start', 'end start'],
    });

    const y = useTransform(scrollYProgress, [0, 1], [0, -100 * speed]);

    return (
        <motion.div
            ref={ref}
            style={{ y }}
            className="parallax-background"
        >
            {children}
        </motion.div>
    );
};

export default ParallaxBackground;
