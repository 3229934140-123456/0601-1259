import { useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-forge-surface border border-forge-border rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border">
          <h2 className="text-lg font-medium text-forge-text font-display">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-forge-text-secondary hover:text-forge-text hover:bg-forge-elevated transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, message }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-forge-text-secondary mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button className="btn-outline" onClick={onClose}>取消</button>
        <button className="bg-forge-crimson text-white px-5 py-2 rounded-lg font-medium hover:bg-forge-crimson-light transition-colors" onClick={onConfirm}>确认</button>
      </div>
    </Modal>
  )
}
