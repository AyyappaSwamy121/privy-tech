import React from 'react';
import { motion } from 'framer-motion';

const MotionCard = ({ 
    children, 
    hover = true,
    delay = 0,
    className = '',
    ...props 
}) => {
    const cardVariants = {
        initial: { opacity: 0, y: 30 },
        animate: { 
            opacity: 1, 
            y: 0,
            transition: {
                duration: 0.5,
                delay,
                ease: [0.22, 1, 0.36, 1],
            }
        },
    };

    const hoverVariants = hover ? {
        hover: {
            y: -8,
            transition: {
                duration: 0.3,
                ease: 'easeOut',
            },
        },
    } : {};

    return (
        <motion.div
            variants={cardVariants}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-50px' }}
            whileHover={hover ? 'hover' : undefined}
            className={className}
            style={{
                ...props.style,
            }}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export default MotionCard;
