import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const AnimatedSection = ({ 
    children, 
    delay = 0, 
    direction = 'up',
    className = '',
    ...props 
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    const variants = {
        hidden: {
            opacity: 0,
            y: direction === 'up' ? 50 : direction === 'down' ? -50 : 0,
            x: direction === 'left' ? 50 : direction === 'right' ? -50 : 0,
        },
        visible: {
            opacity: 1,
            y: 0,
            x: 0,
            transition: {
                duration: 0.6,
                delay,
                ease: [0.22, 1, 0.36, 1],
            },
        },
    };

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={variants}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default AnimatedSection;
