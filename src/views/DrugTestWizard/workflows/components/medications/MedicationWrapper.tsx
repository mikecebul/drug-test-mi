'use client'

import { motion } from 'motion/react'

export const MedicationMotionWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ marginBottom: 0 }}
    animate={{ marginBottom: 12 }}
    exit={{ marginBottom: 0 }}
    transition={{ duration: 0.22 }}
  >
    <motion.div
      layout
      initial={{ opacity: 0, height: 0, y: -10, scale: 0.985 }}
      animate={{ opacity: 1, height: 'auto', y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, y: -6, scale: 0.985, transition: { duration: 0.18 } }}
      transition={{
        opacity: { duration: 0.18, delay: 0.04 },
        height: { duration: 0.22 },
        y: { duration: 0.22 },
        scale: { duration: 0.22 },
      }}
    >
      {children}
    </motion.div>
  </motion.div>
)
