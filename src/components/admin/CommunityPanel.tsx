'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, MessageSquare, Users, Trash2, Pencil, Check, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import type { Discussion } from '@/stores/app-store'

const GRADES = [
  'الصف السادس الابتدائي',
  'الصف الأول الاعدادي',
  'الصف الثاني الاعدادي',
  'الصف الثالث الاعدادي',
    'اولي باكالوريا',
]

export function CommunityPanel() {
  const [selectedGrade, setSelectedGrade] = useState('')
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Edit & Delete states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadDiscussions = async () => {
    if (!selectedGrade) { setDiscussions([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/discussions?grade=${encodeURIComponent(selectedGrade)}&pageSize=100`)
      const data = await res.json()
      setDiscussions(data.discussions || [])
    } catch { toast.error('مش قادر يحمل النقاشات') }
    setLoading(false)
  }

  useEffect(() => { loadDiscussions() }, [selectedGrade])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [discussions])

  const handleReply = async () => {
    if (!replyText.trim() || !selectedGrade) return
    setSending(true)
    try {
      await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: selectedGrade, content: replyText.trim(), isAdminReply: true }),
      })
      setReplyText('')
      loadDiscussions()
      toast.success('بعت الرد!')
    } catch { toast.error('مش قادر يبعت الرد') }
    setSending(false)
  }

  const handleEdit = async (id: string) => {
    if (!editText.trim()) return
    try {
      const res = await fetch(`/api/discussions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editText.trim() }),
      })
      if (res.ok) {
        setEditingId(null)
        setEditText('')
        loadDiscussions()
        toast.success('الرسالة اتعدلت!')
      } else {
        toast.error('مش قادر يعدل الرسالة')
      }
    } catch { toast.error('حصل مشكلة') }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/discussions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDiscussions(prev => prev.filter(d => d.id !== id))
        toast.success('الرسالة اتشالت!')
      } else {
        toast.error('مش قادر يشيل الرسالة')
      }
    } catch { toast.error('حصل مشكلة') }
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            إدارة المجتمعات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm flex-1"
            >
              <option value="">اختار صف...</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {selectedGrade && (
              <Badge variant="outline" className="text-xs border-sky-300/40 text-sky-600 h-10 px-3 flex items-center">
                {discussions.length} رسالة
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedGrade && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              مجتمع {selectedGrade}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : discussions.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">مفيش رسائل في المجتمع ده لسه</p>
            ) : (
              <>
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {discussions.map((d) => {
                    const isAdmin = d.isAdminReply
                    const isEditing = editingId === d.id

                    return (
                      <div
                        key={d.id}
                        className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] group relative ${
                          isAdmin
                            ? 'bg-sky-50 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-800/30 rounded-2xl rounded-bl-md'
                            : 'bg-muted rounded-2xl rounded-br-md'
                        }`}>
                          {/* Edit/Delete buttons - show on hover */}
                          <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button
                              onClick={function() { setEditingId(d.id); setEditText(d.content) }}
                              className="h-6 w-6 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white dark:hover:bg-black/70 transition-colors"
                              title="تعديل"
                            >
                              <Pencil className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                            </button>
                            <button
                              onClick={function() { if (confirm('متأكد إنك عاوز تشيل الرسالة دي؟')) handleDelete(d.id) }}
                              className="h-6 w-6 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                              title="حذف"
                              disabled={deletingId === d.id}
                            >
                              {deletingId === d.id
                                ? <Loader2 className="h-3 w-3 text-rose-500 animate-spin" />
                                : <Trash2 className="h-3 w-3 text-rose-500" />
                              }
                            </button>
                          </div>

                          {/* Message content or edit mode */}
                          <div className="px-4 py-2.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-xs font-semibold ${isAdmin ? 'text-sky-600 dark:text-sky-400' : 'text-foreground'}`}>
                                {d.studentName}
                              </p>
                              {isAdmin && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-sky-300/40 text-sky-600">admin</Badge>}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 mt-1">
                                <Input
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="text-sm h-8"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleEdit(d.id)
                                    if (e.key === 'Escape') { setEditingId(null); setEditText('') }
                                  }}
                                  autoFocus
                                />
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={function() { setEditingId(null); setEditText('') }}
                                    className="h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={function() { handleEdit(d.id) }}
                                    className="h-6 w-6 rounded-full bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed">{d.content}</p>
                            )}

                            <p className={`text-[10px] mt-1 ${isAdmin ? 'text-sky-400' : 'text-muted-foreground'}`}>
                              {new Date(d.createdAt).toLocaleString('ar-EG')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={chatEndRef} />
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    placeholder="اكتب ردك هنا..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                    className="flex-1"
                  />
                  <Button onClick={handleReply} disabled={sending || !replyText.trim()} size="icon">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
