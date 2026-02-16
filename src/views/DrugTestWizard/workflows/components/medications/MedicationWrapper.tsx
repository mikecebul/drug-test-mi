'use client'

import { motion } from 'motion/react'

export const MedicationMotionWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ marginBottom: 0 }}
    animate={{ marginBottom: 12 }}
    exit={{ marginBottom: 0 }}
    transition={{ duration: 0.3 }}
  >
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
      transition={{
        opacity: { duration: 0.05, delay: 0.15 },
        height: { duration: 0.2 },
      }}
    >
      {children}
    </motion.div>
  </motion.div>
)
