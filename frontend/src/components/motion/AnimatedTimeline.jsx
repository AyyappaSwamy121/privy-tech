import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const AnimatedTimeline = ({ steps, className = '' }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const stepVariants = {
        hidden: { opacity: 0, x: -50 },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
            },
        },
    };

    const lineVariants = {
        hidden: { scaleY: 0, originY: 0 },
        visible: {
            scaleY: 1,
            transition: {
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
            },
        },
    };

    return (
        <motion.div
            ref={ref}
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className={className}
            style={{ position: 'relative', paddingLeft: '2rem' }}
        >
            {/* Vertical line */}
            <motion.div
                variants={lineVariants}
                style={{
                    position: 'absolute',
                    left: '0.5rem',
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    background: 'linear-gradient(to bottom, var(--neon-blue), var(--neon-green))',
                }}
            />
            
            {steps.map((step, index) => (
                <motion.div
                    key={index}
                    variants={stepVariants}
                    style={{
                        position: 'relative',
                        marginBottom: index < steps.length - 1 ? '3rem' : 0,
                        paddingLeft: '2rem',
                    }}
                >
                    {/* Dot */}
                    <motion.div
                        style={{
                            position: 'absolute',
                            left: '-1.5rem',
                            top: '0.5rem',
                            width: '1rem',
                            height: '1rem',
                            borderRadius: '50%',
                            background: 'var(--neon-blue)',
                            border: '2px solid var(--bg-color)',
                            boxShadow: '0 0 15px var(--neon-blue)',
                        }}
                        whileHover={{ scale: 1.3 }}
                    />
                    
                    {step}
                </motion.div>
            ))}
        </motion.div>
    );
};

export default AnimatedTimeline;
