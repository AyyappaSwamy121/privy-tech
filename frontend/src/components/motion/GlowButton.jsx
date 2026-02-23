import React from 'react';
import { motion } from 'framer-motion';

const GlowButton = ({ 
    children, 
    onClick, 
    disabled = false,
    variant = 'primary',
    className = '',
    ...props 
}) => {
    const variants = {
        primary: {
            background: 'var(--neon-blue)',
            color: '#000',
            borderColor: 'var(--neon-blue)',
        },
        secondary: {
            background: 'transparent',
            color: 'var(--neon-blue)',
            borderColor: 'var(--neon-blue)',
        },
    };

    return (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            className={className}
            style={{
                ...variants[variant],
                position: 'relative',
                overflow: 'hidden',
                ...props.style,
            }}
            whileHover={!disabled ? {
                scale: 1.02,
                boxShadow: '0 0 30px var(--neon-blue)',
            } : {}}
            whileTap={!disabled ? { scale: 0.98 } : {}}
            transition={{ duration: 0.2 }}
            {...props}
        >
            {children}
            {!disabled && (
                <motion.span
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: 0,
                        height: 0,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.3)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                    }}
                    initial={{ width: 0, height: 0 }}
                    whileTap={{
                        width: 300,
                        height: 300,
                        transition: { duration: 0.6 },
                    }}
                />
            )}
        </motion.button>
    );
};

export default GlowButton;
