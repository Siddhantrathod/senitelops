import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, MessageSquare, Clock, CheckCircle, Shield } from 'lucide-react'
import { cn } from '../utils/helpers'
import { submitFeedback, fetchUserFeedback } from '../services/api'
import { notyf } from '../utils/notifications'

export default function FeedbackModal({ open, onClose }) {
  const [message, setMessage] = useState('')
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadFeedbacks()
    }
  }, [open])

  const loadFeedbacks = async () => {
    setLoading(true)
    try {
      const data = await fetchUserFeedback()
      setFeedbacks(data)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!message.trim()) return

    setSubmitting(true)
    try {
      await submitFeedback(message)
      notyf.success('Feedback submitted successfully!')
      setMessage('')
      loadFeedbacks()
    } catch (err) {
      notyf.error(err.response?.data?.error || 'Failed to submit feedback')
    }
    setSubmitting(false)
  }

  if (!open) return null

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface/80 dark:bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative w-full max-w-2xl bg-surface-secondary/95 dark:bg-surface-secondary/90 border border-theme rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-steel-50">Platform Feedback</h2>
              <p className="text-sm text-steel-400">Share your thoughts or report an issue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-steel-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Submit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-steel-200 mb-2">New Feedback</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think or describe an issue you've encountered..."
                rows={4}
                className="w-full bg-black/20 border border-theme rounded-xl p-4 text-sm text-steel-100 placeholder:text-steel-600 focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
                required
              />
            </div>
            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={submitting || !message.trim()}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <Send className="w-4 h-4" /> Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Previous Feedbacks */}
          {feedbacks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider font-mono">Your Feedback History</h3>
              <div className="space-y-4">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="p-4 bg-white/[0.02] border border-theme rounded-xl space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border',
                          fb.status === 'reviewed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        )}>
                          {fb.status === 'reviewed' ? <CheckCircle className="w-3 h-3 inline mr-1 -mt-0.5" /> : <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />}
                          {fb.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-steel-500 font-mono">{new Date(fb.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-steel-200">{fb.message}</p>
                    
                    {/* Admin Reply */}
                    {fb.admin_reply && (
                      <div className="mt-4 p-3 bg-blue-500/5 border-l-2 border-blue-500/50 rounded-r-lg">
                        <p className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                          <Shield className="w-3 h-3" /> Admin Reply
                          <span className="text-[10px] text-steel-500 font-mono ml-auto tracking-normal">{new Date(fb.replied_at).toLocaleString()}</span>
                        </p>
                        <p className="text-sm text-steel-300">{fb.admin_reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
