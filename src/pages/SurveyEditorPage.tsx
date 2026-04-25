import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { ChevronDown, ChevronUp, Plus, Save } from 'lucide-react'
import { api } from '../lib/api'
import { slugify } from '../lib/helpers'
import type {
  QuestionType,
  Survey,
  SurveyIdentityMode,
  SurveyPage,
  SurveyQuestion,
  SurveyStatus,
  SurveyTemplate,
  SurveyType,
} from '../types'
import { Badge, Button, Card, Input, Mono, Select, Textarea } from '../components/ui'

const questionTypes: Array<{ label: string; value: QuestionType }> = [
  { label: 'Single choice', value: 'single_choice' },
  { label: 'Multiple choice', value: 'multiple_choice' },
  { label: 'Text', value: 'text' },
  { label: 'Multi-text', value: 'multi_text' },
  { label: 'Rating 1-5', value: 'rating' },
  { label: 'Yes/No', value: 'yes_no' },
]

type EditorSurvey = {
  title: string
  description: string
  cover_image_url: string
  cover_image_alt: string
  type: SurveyType
  status: SurveyStatus
  identity_mode: SurveyIdentityMode
  slug: string
  access_code: string
  pages: SurveyPage[]
  questions: SurveyQuestion[]
}

const baseTemplate: EditorSurvey = {
  title: '',
  description: '',
  cover_image_url: '',
  cover_image_alt: '',
  type: 'onboarding',
  status: 'unpublished',
  identity_mode: 'required',
  slug: '',
  access_code: nanoid(8).toUpperCase(),
  pages: [{ id: nanoid(6), title: 'Page 1', description: '', order: 1 }],
  questions: [] as SurveyQuestion[],
}

export function SurveyEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)

  const [form, setForm] = useState<EditorSurvey>(baseTemplate)
  const [activePageId, setActivePageId] = useState(baseTemplate.pages[0].id)
  const [banner, setBanner] = useState('')
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<SurveyTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [setupTab, setSetupTab] = useState<'details' | 'cover'>('details')

  const refreshTemplates = () => api.listTemplates().then(setTemplates)

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return

    const pageIdMap = new Map<string, string>()
    const pages = template.pages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((page, index) => {
        const nextId = nanoid(6)
        pageIdMap.set(page.id, nextId)
        return {
          ...page,
          id: nextId,
          order: index + 1,
        }
      })

    const questions = template.questions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((question) => ({
        ...question,
        id: nanoid(8),
        page_id: pageIdMap.get(question.page_id) ?? pages[0]?.id ?? nanoid(6),
      }))

    setForm((prev) => ({
      ...prev,
      description: template.description,
      cover_image_url: template.cover_image_url,
      cover_image_alt: template.cover_image_alt,
      type: template.type,
      identity_mode: template.identity_mode,
      pages,
      questions,
    }))
    setActivePageId(pages[0]?.id ?? '')
    setBanner(`Applied template: ${template.name}`)
  }

  useEffect(() => {
    if (!editing || !id) return
    api
      .getSurvey(id)
      .then((survey) => {
        setForm({
          title: survey.title,
          description: survey.description,
          cover_image_url: survey.cover_image_url,
          cover_image_alt: survey.cover_image_alt,
          type: survey.type,
          status: survey.status,
          identity_mode: survey.identity_mode,
          slug: survey.slug,
          access_code: survey.access_code,
          pages: survey.pages,
          questions: survey.questions,
        })
        setActivePageId(survey.pages[0]?.id)
      })
      .catch(console.error)
  }, [editing, id])

  useEffect(() => {
    refreshTemplates().catch(console.error)
  }, [])

  const activePage = useMemo(
    () => form.pages.find((page) => page.id === activePageId) ?? form.pages[0],
    [activePageId, form.pages]
  )

  const pageQuestions = useMemo(
    () =>
      form.questions
        .filter((q) => q.page_id === activePage?.id)
        .sort((a, b) => a.order - b.order),
    [form.questions, activePage]
  )

  const setPages = (pages: SurveyPage[]) => {
    setForm((prev) => ({
      ...prev,
      pages: pages.map((page, index) => ({ ...page, order: index + 1 })),
    }))
  }

  const addPage = () => {
    const page: SurveyPage = {
      id: nanoid(6),
      title: `Page ${form.pages.length + 1}`,
      description: '',
      order: form.pages.length + 1,
    }
    setPages([...form.pages, page])
    setActivePageId(page.id)
  }

  const removePage = (pageId: string) => {
    if (form.pages.length <= 1) {
      setBanner('A survey needs at least one page.')
      return
    }

    const remaining = form.pages.filter((page) => page.id !== pageId)
    setPages(remaining)
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.page_id !== pageId),
    }))
    setActivePageId(remaining[0].id)
  }

  const addQuestion = () => {
    if (!activePage) return

    const question: SurveyQuestion = {
      id: nanoid(8),
      page_id: activePage.id,
      order: pageQuestions.length + 1,
      type: 'single_choice',
      text: 'Untitled question',
      required: false,
      options: ['Option A', 'Option B'],
      branching: [],
    }

    setForm((prev) => ({ ...prev, questions: [...prev.questions, question] }))
  }

  const updateQuestion = (questionId: string, patch: Partial<SurveyQuestion>) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      ),
    }))
  }

  const removeQuestion = (questionId: string) => {
    setForm((prev) => {
      const remaining = prev.questions.filter((q) => q.id !== questionId)
      const nextQuestions = remaining
        .map((question) => ({ ...question }))
        .sort((a, b) => a.order - b.order)

      const orderByPage = new Map<string, number>()
      for (const question of nextQuestions) {
        const nextOrder = (orderByPage.get(question.page_id) ?? 0) + 1
        orderByPage.set(question.page_id, nextOrder)
        question.order = nextOrder
      }

      return {
        ...prev,
        questions: nextQuestions,
      }
    })
  }

  const moveQuestion = (questionId: string, direction: 'up' | 'down') => {
    setForm((prev) => {
      const question = prev.questions.find((item) => item.id === questionId)
      if (!question) return prev

      const pageQuestions = prev.questions
        .filter((item) => item.page_id === question.page_id)
        .sort((a, b) => a.order - b.order)

      const fromIndex = pageQuestions.findIndex((item) => item.id === questionId)
      if (fromIndex === -1) return prev

      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
      if (toIndex < 0 || toIndex >= pageQuestions.length) return prev

      const nextPageQuestions = [...pageQuestions]
      const [moved] = nextPageQuestions.splice(fromIndex, 1)
      nextPageQuestions.splice(toIndex, 0, moved)

      const pageQuestionById = new Map(
        nextPageQuestions.map((item, index) => [item.id, { ...item, order: index + 1 }])
      )

      return {
        ...prev,
        questions: prev.questions.map((item) => pageQuestionById.get(item.id) ?? item),
      }
    })
  }

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= form.pages.length) return
    const next = [...form.pages]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setPages(next)
  }

  const normalizedQuestions = (questions: SurveyQuestion[]) =>
    questions.map((question) => {
      if (question.type !== 'single_choice' && question.type !== 'multiple_choice') {
        return { ...question, options: [] }
      }

      return {
        ...question,
        options: (question.options ?? []).map((value) => value.trim()).filter(Boolean),
      }
    })

  const onSave = async () => {
    setLoading(true)
    try {
      const payload = {
        ...form,
        questions: normalizedQuestions(form.questions),
        slug: form.slug || slugify(form.title),
      }
      if (editing && id) {
        await api.updateSurvey(id, payload)
      } else {
        await api.createSurvey(payload)
      }
      setBanner('Survey saved successfully.')
      navigate('/surveys')
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Unable to save survey.')
    } finally {
      setLoading(false)
    }
  }

  const onSaveTemplate = async () => {
    const name = templateName.trim() || `${form.title || 'Survey'} Template`
    if (!form.pages.length) {
      setBanner('Add at least one page before saving a template.')
      return
    }

    setLoading(true)
    try {
      await api.createTemplate({
        name,
        description: form.description,
        cover_image_url: form.cover_image_url,
        cover_image_alt: form.cover_image_alt,
        type: form.type,
        identity_mode: form.identity_mode,
        pages: form.pages,
        questions: normalizedQuestions(form.questions),
      })
      setTemplateName('')
      await refreshTemplates()
      setBanner(`Template saved: ${name}`)
    } catch (error) {
      setBanner(error instanceof Error ? error.message : 'Unable to save template.')
    } finally {
      setLoading(false)
    }
  }

  const onAttachCoverPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setBanner('Please choose an image file for the cover photo.')
      event.target.value = ''
      return
    }

    const maxBytes = 5 * 1024 * 1024
    if (file.size > maxBytes) {
      setBanner('Cover photo is too large. Please select an image smaller than 5MB.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      setForm((prev) => ({
        ...prev,
        cover_image_url: result,
        cover_image_alt:
          prev.cover_image_alt || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      }))
      setBanner(`Attached cover photo: ${file.name}`)
    }
    reader.onerror = () => {
      setBanner('Unable to read the selected file. Please try another image.')
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-sm p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="md:flex-1">
          <h1 className="text-2xl font-semibold">{editing ? 'Survey Editor' : 'Create Survey'}</h1>
          <p className="text-sm text-muted-foreground">Build a multi-page survey with branching logic.</p>
        </div>
        <div className="flex flex-col gap-2 w-full md:flex-1 md:items-stretch">
          <Select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, status: event.target.value as Survey['status'] }))
            }
            className="w-full"
          >
            <option value="unpublished">Unpublished</option>
            <option value="published">Published</option>
          </Select>
          <div className="flex items-center gap-2 w-full">
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={onSaveTemplate}
              disabled={loading}
              title="Save as Template"
              aria-label="Save as Template"
            >
              <Save className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onSave} disabled={loading} className="self-end">
            Save
          </Button>
        </div>
      </div>

      {banner && (
        <Card className="px-4 py-3 text-sm flex justify-between items-center">
          <span>{banner}</span>
          <Button variant="ghost" onClick={() => setBanner('')}>
            Dismiss
          </Button>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="border-b border-border">
          <nav className="flex items-end gap-5">
            <button
              type="button"
              onClick={() => setSetupTab('details')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                setupTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              aria-current={setupTab === 'details' ? 'page' : undefined}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setSetupTab('cover')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                setupTab === 'cover'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              aria-current={setupTab === 'cover' ? 'page' : undefined}
            >
              Cover Photo
            </button>
          </nav>
        </div>

        {setupTab === 'details' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Apply Template</label>
                <Select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="secondary"
                disabled={!selectedTemplateId}
                onClick={() => applyTemplate(selectedTemplateId)}
              >
                Apply Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) => {
                    const title = event.target.value
                    setForm((prev) => ({ ...prev, title, slug: slugify(title) }))
                  }}
                  placeholder="New Employee Onboarding"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Type</label>
                <Select
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, type: event.target.value as Survey['type'] }))
                  }
                >
                  <option value="onboarding">Onboarding</option>
                  <option value="offboarding">Offboarding</option>
                  <option value="general">General</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Response Identity Mode</label>
              <Select
                value={form.identity_mode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    identity_mode: event.target.value as SurveyIdentityMode,
                  }))
                }
              >
                <option value="required">Required (name and email)</option>
                <option value="optional">Optional (respondent may skip)</option>
                <option value="hidden">Hidden (anonymous only)</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls whether respondents must identify themselves, can choose, or stay fully anonymous.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Description</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Survey URL Slug</label>
                <Input
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Used in the public link: /s/your-slug/access-code. Use lowercase letters, numbers, and hyphens.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Access Code</label>
                <Input
                  value={form.access_code}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, access_code: event.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>
          </>
        )}

        {setupTab === 'cover' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add a responsive cover image that appears on public surveys and admin list previews.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Image URL</label>
                <Input
                  value={form.cover_image_url}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cover_image_url: event.target.value.trim() }))
                  }
                  placeholder="https://example.com/cover.jpg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">Attach Cover Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onAttachCoverPhoto}
                  className="h-9 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none file:mr-3 file:border-0 file:bg-transparent file:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Choose an image from your device (max 5MB).</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs uppercase text-muted-foreground">Alt Text</label>
                <Input
                  value={form.cover_image_alt}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cover_image_alt: event.target.value }))
                  }
                  placeholder="Describe the cover image"
                />
              </div>
            </div>
            <div className="rounded-sm border border-border bg-muted overflow-hidden">
              {form.cover_image_url ? (
                <div className="relative aspect-[16/7] w-full">
                  <img
                    src={form.cover_image_url}
                    alt={form.cover_image_alt || 'Survey cover preview'}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                  <p className="absolute left-3 bottom-3 text-sm text-white font-medium">Cover Preview</p>
                </div>
              ) : (
                <div className="aspect-[16/7] w-full grid place-items-center text-sm text-muted-foreground">
                  No cover photo selected.
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Pages</h3>
            <Button variant="secondary" onClick={addPage}>
              Add Page
            </Button>
          </div>

          <div className="space-y-2">
            {form.pages
              .sort((a, b) => a.order - b.order)
              .map((page, index) => (
                <div
                  key={page.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('text/page-index', String(index))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const fromIndex = Number(event.dataTransfer.getData('text/page-index'))
                    movePage(fromIndex, index)
                  }}
                  className={`border border-border rounded-sm p-2 ${
                    page.id === activePage?.id ? 'bg-accent' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="text-left w-full"
                    onClick={() => setActivePageId(page.id)}
                  >
                    <p className="font-medium text-sm">{page.title}</p>
                    <Mono className="text-xs text-muted-foreground">page_{page.order}</Mono>
                  </button>

                  <div className="mt-2 flex justify-between text-xs">
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => movePage(index, index - 1)}
                    >
                      Up
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => movePage(index, index + 1)}
                    >
                      Down
                    </button>
                    <button className="text-destructive" onClick={() => removePage(page.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Input
                value={activePage?.title ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    pages: prev.pages.map((page) =>
                      page.id === activePage?.id ? { ...page, title: event.target.value } : page
                    ),
                  }))
                }
                className="text-lg font-semibold"
              />
              <Input
                value={activePage?.description ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    pages: prev.pages.map((page) =>
                      page.id === activePage?.id
                        ? { ...page, description: event.target.value }
                        : page
                    ),
                  }))
                }
                className="mt-2"
                placeholder="Page description"
              />
            </div>
            <Button variant="secondary" onClick={addQuestion} aria-label="Add Question">
              <Plus className="h-4 w-4 md:hidden" />
              <span className="hidden md:inline">Add Question</span>
            </Button>
          </div>

          <div className="space-y-3">
            {pageQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions on this page yet.</p>
            )}

            {pageQuestions.map((question, index) => (
              <div key={question.id} className="border border-border rounded-sm p-3 space-y-3">
                <div>
                  <Input
                    value={question.text}
                    onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveQuestion(question.id, 'up')}
                    disabled={index === 0}
                    aria-label="Move question up"
                    title="Move question up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveQuestion(question.id, 'down')}
                    disabled={index === pageQuestions.length - 1}
                    aria-label="Move question down"
                    title="Move question down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" onClick={() => removeQuestion(question.id)}>
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    value={question.type}
                    onChange={(event) =>
                      updateQuestion(question.id, {
                        type: event.target.value as QuestionType,
                        options:
                          event.target.value === 'single_choice' ||
                          event.target.value === 'multiple_choice'
                            ? question.options && question.options.length > 0
                              ? question.options
                              : ['Option A', 'Option B']
                            : [],
                      })
                    }
                  >
                    {questionTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </Select>

                  <label className="h-9 border border-border rounded-sm px-3 inline-flex items-center justify-between text-sm">
                    Required
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) =>
                        updateQuestion(question.id, { required: event.target.checked })
                      }
                    />
                  </label>

                  <Badge className="bg-muted text-muted-foreground justify-center h-9 rounded-sm">
                    Question {index + 1}
                  </Badge>
                </div>

                {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-muted-foreground">Options (one per line)</label>
                    <Textarea
                      rows={3}
                      value={(question.options ?? []).join('\n')}
                      onChange={(event) =>
                        updateQuestion(question.id, {
                          options: event.target.value.split('\n'),
                        })
                      }
                    />
                  </div>
                )}

                {(question.type === 'single_choice' || question.type === 'yes_no') && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Branching Logic</p>
                    <p className="text-xs text-muted-foreground">Target can be a page or a specific question.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(question.branching ?? []).map((rule, ruleIndex) => (
                        <div key={`${rule.value}-${ruleIndex}`} className="flex gap-2">
                          <Select
                            value={rule.value}
                            onChange={(event) => {
                              const next = [...(question.branching ?? [])]
                              next[ruleIndex] = { ...next[ruleIndex], value: event.target.value }
                              updateQuestion(question.id, { branching: next })
                            }}
                          >
                            <option value="">When answer is</option>
                            {(question.type === 'yes_no' ? ['yes', 'no'] : question.options ?? []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                          <Select
                            value={rule.goToPageId}
                            onChange={(event) => {
                              const next = [...(question.branching ?? [])]
                              next[ruleIndex] = { ...next[ruleIndex], goToPageId: event.target.value }
                              updateQuestion(question.id, { branching: next })
                            }}
                          >
                            <option value="">Select destination</option>
                            {form.pages.map((page) => (
                              <option key={page.id} value={page.id}>
                                Page: {page.title}
                              </option>
                            ))}
                            {form.questions
                              .filter((candidate) => candidate.id !== question.id)
                              .map((candidate) => {
                                const candidatePage = form.pages.find((page) => page.id === candidate.page_id)
                                return (
                                  <option key={candidate.id} value={candidate.id}>
                                    Question: {candidate.text || 'Untitled'} ({candidatePage?.title ?? 'Unknown page'})
                                  </option>
                                )
                              })}
                            {form.questions
                              .filter((candidate) => candidate.id !== question.id)
                              .length === 0 && (
                              <option value={form.pages[0]?.id ?? ''} disabled>
                                Add another question to branch directly by question
                              </option>
                            )}
                          </Select>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateQuestion(question.id, {
                          branching: [
                            ...(question.branching ?? []),
                            { value: '', goToPageId: form.pages[0]?.id ?? '' },
                          ],
                        })
                      }
                    >
                      Add Rule
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
