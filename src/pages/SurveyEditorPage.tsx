import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { Save } from 'lucide-react'
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
  { label: 'Rating 1-5', value: 'rating' },
  { label: 'Yes/No', value: 'yes_no' },
]

type EditorSurvey = {
  title: string
  description: string
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
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }))
  }

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= form.pages.length) return
    const next = [...form.pages]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setPages(next)
  }

  const onSave = async () => {
    setLoading(true)
    try {
      const payload = {
        ...form,
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
        type: form.type,
        identity_mode: form.identity_mode,
        pages: form.pages,
        questions: form.questions,
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

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-sm p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{editing ? 'Survey Editor' : 'Create Survey'}</h1>
          <p className="text-sm text-muted-foreground">Build a multi-page survey with branching logic.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template name"
            className="w-[180px]"
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
          <Select
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, status: event.target.value as Survey['status'] }))
            }
            className="w-[160px]"
          >
            <option value="unpublished">Unpublished</option>
            <option value="published">Published</option>
          </Select>
          <Button onClick={onSave} disabled={loading}>
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
        <h2 className="font-semibold">Meta</h2>
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
            <Button variant="secondary" onClick={addQuestion}>
              Add Question
            </Button>
          </div>

          <div className="space-y-3">
            {pageQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions on this page yet.</p>
            )}

            {pageQuestions.map((question, index) => (
              <div key={question.id} className="border border-border rounded-sm p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Input
                    value={question.text}
                    onChange={(event) => updateQuestion(question.id, { text: event.target.value })}
                  />
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
                          options: event.target.value
                            .split('\n')
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                )}

                {(question.type === 'single_choice' || question.type === 'yes_no') && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Branching Logic</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(question.branching ?? []).map((rule, ruleIndex) => (
                        <div key={`${rule.value}-${ruleIndex}`} className="flex gap-2">
                          <Input
                            value={rule.value}
                            onChange={(event) => {
                              const next = [...(question.branching ?? [])]
                              next[ruleIndex] = { ...next[ruleIndex], value: event.target.value }
                              updateQuestion(question.id, { branching: next })
                            }}
                            placeholder="When answer is"
                          />
                          <Select
                            value={rule.goToPageId}
                            onChange={(event) => {
                              const next = [...(question.branching ?? [])]
                              next[ruleIndex] = { ...next[ruleIndex], goToPageId: event.target.value }
                              updateQuestion(question.id, { branching: next })
                            }}
                          >
                            {form.pages.map((page) => (
                              <option key={page.id} value={page.id}>
                                {page.title}
                              </option>
                            ))}
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
