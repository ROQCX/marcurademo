"use client"

import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { Ship, CreditCard, Anchor } from "lucide-react"

const PRODUCTS = [
  {
    id: "da-desk",
    name: "DA-Desk",
    description: "Port cost control",
    icon: Anchor,
  },
  {
    id: "martrust",
    name: "MarTrust",
    description: "Payment solutions",
    icon: CreditCard,
  },
  {
    id: "shipserv",
    name: "ShipServ",
    description: "E-procurement",
    icon: Ship,
  },
] as const

interface ProductPillsProps {
  onSelect: (productName: string) => void
}

export function ProductPills({ onSelect }: ProductPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {PRODUCTS.map((product, index) => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(product.name)}
            className="group h-auto gap-2 rounded-full border-gray-200 bg-white px-4 py-2 text-xs hover:bg-[#143232] hover:text-white hover:border-[#143232] transition-all shadow-sm text-[#495057]"
          >
            <product.icon className="h-3.5 w-3.5 text-[#143232] group-hover:text-white transition-colors" />
            <span className="font-medium text-[#212529] group-hover:text-white">{product.name}</span>
            <span className="text-[#6C757D] border-l border-gray-200 pl-2 ml-1 group-hover:text-white/90 group-hover:border-white/30 transition-colors">{product.description}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  )
}
