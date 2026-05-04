import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { api, getApiUrl } from '../lib/api'
import type { SeedSummary, Survey, SurveyGroup } from '../types'
import { Button, Card, Input, Mono, Select } from '../components/ui'

type SettingsSectionKey = 'api_docs' | 'groups' | 'disclaimer' | 'save_resume' | 'seed'

export function SettingsPage() {
  const [seedAction, setSeedAction] = useState<'all' | 'responses' | null>(null)
  const [seedSummary, setSeedSummary] = useState<SeedSummary | null>(null)
  const [seedError, setSeedError] = useState('')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState('all')
  const [groups, setGroups] = useState<SurveyGroup[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [groupNamesById, setGroupNamesById] = useState<Record<string, string>>({})
  const [groupActionId, setGroupActionId] = useState<string | null>(null)
  const [groupError, setGroupError] = useState('')
  const [saveResumeEnabled, setSaveResumeEnabled] = useState(true)
  const [autosaveTimeoutMs, setAutosaveTimeoutMs] = useState(60000)
  const [disclaimerText, setDisclaimerText] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [openSections, setOpenSections] = useState<Record<SettingsSectionKey, boolean>>({
    api_docs: false,
    groups: false,
    disclaimer: false,
    save_resume: false,
    seed: false,
  })

  const toggleSection = (key: SettingsSectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const loadGroups = async () => {
    const groupList = await api.listGroups()
    setGroups(groupList)
    setGroupNamesById(
      groupList.reduce<Record<string, string>>((accumulator, group) => {
        accumulator[group.id] = group.name
        return accumulator
      }, {})
    )
  }

  useEffect(() => {
    Promise.all([api.listSurveys(), api.getAdminSettings(), loadGroups()])
      .then(([surveyList, settings]) => {
        setSurveys(surveyList)
        setSaveResumeEnabled(settings.save_resume_enabled)
        setAutosaveTimeoutMs(settings.autosave_timeout_ms)
        setDisclaimerText(settings.disclaimer_text)
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false))
  }, [])

  const updateSettings = async (enabled: boolean, timeoutMs: number, disclaimer: string) => {
    setSettingsSaving(true)
    setSettingsError('')
    try {
      const settings = await api.updateAdminSettings({ 
        save_resume_enabled: enabled, 
        autosave_timeout_ms: timeoutMs,
        disclaimer_text: disclaimer
      })
      setSaveResumeEnabled(settings.save_resume_enabled)
      setAutosaveTimeoutMs(settings.autosave_timeout_ms)
      setDisclaimerText(settings.disclaimer_text)
    } catch {
      setSettingsError('Unable to update settings right now. Please try again.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const addGroup = async () => {
    const name = newGroupName.trim()
    if (!name) {
      return
    }

    setGroupActionId('new')
    setGroupError('')
    try {
      await api.createGroup({ name })
      setNewGroupName('')
      await loadGroups()
    } catch {
      setGroupError('Unable to add group right now. Please try again.')
    } finally {
      setGroupActionId(null)
    }
  }

  const saveGroup = async (groupId: string) => {
    const name = (groupNamesById[groupId] ?? '').trim()
    if (!name) {
      return
    }

    setGroupActionId(groupId)
    setGroupError('')
    try {
      await api.updateGroup(groupId, { name })
      await loadGroups()
    } catch {
      setGroupError('Unable to update this group right now. Please try again.')
    } finally {
      setGroupActionId(null)
    }
  }

  const removeGroup = async (groupId: string) => {
    setGroupActionId(groupId)
    setGroupError('')
    try {
      await api.deleteGroup(groupId)
      await loadGroups()
    } catch {
      setGroupError('Unable to delete this group. It may still be assigned to surveys.')
    } finally {
      setGroupActionId(null)
    }
  }

  const runSeedAll = async () => {
    setSeedAction('all')
    setSeedError('')
    try {
      const result = await api.seedDemoData()
      setSeedSummary(result)
    } catch {
      setSeedError('Unable to seed data right now. Please verify the API server is reachable and try again.')
    } finally {
      setSeedAction(null)
    }
  }

  const runSeedResponsesOnly = async () => {
    setSeedAction('responses')
    setSeedError('')
    try {
      const result = await api.seedRecentResponsesOnly(
        selectedSurveyId !== 'all' ? selectedSurveyId : undefined
      )
      setSeedSummary(result)
    } catch {
      setSeedError('Unable to seed responses right now. Please verify the API server is reachable and try again.')
    } finally {
      setSeedAction(null)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Administrator tools and configuration links.</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">API docs</h2>
          <Button variant="ghost" onClick={() => toggleSection('api_docs')} aria-label="Toggle API docs section">
            {openSections.api_docs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        {openSections.api_docs && (
          <>
            <p className="text-sm text-muted-foreground">
              Open the Swagger UI documentation for all survey management endpoints.
            </p>
            <a
              href={getApiUrl('/api/docs')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary text-sm"
            >
              Open Swagger UI
              <ExternalLink className="h-4 w-4" />
            </a>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Target Groups</h2>
          <Button variant="ghost" onClick={() => toggleSection('groups')} aria-label="Toggle target groups section">
            {openSections.groups ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {openSections.groups && (
          <>
            <p className="text-sm text-muted-foreground">
              Maintain the list of target groups available when creating or editing surveys.
            </p>

            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.id} className="grid grid-cols-1 gap-2 rounded-sm border border-border p-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <Input
                    value={groupNamesById[group.id] ?? group.name}
                    onChange={(event) =>
                      setGroupNamesById((prev) => ({
                        ...prev,
                        [group.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void saveGroup(group.id)}
                    disabled={groupActionId === group.id}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void removeGroup(group.id)}
                    disabled={groupActionId === group.id || groups.length <= 1}
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Add a new target group"
              />
              <Button onClick={() => void addGroup()} disabled={groupActionId === 'new'}>
                Add Group
              </Button>
            </div>

            {groupError && <p className="text-sm text-destructive">{groupError}</p>}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Disclaimer Text</h2>
          <Button variant="ghost" onClick={() => toggleSection('disclaimer')} aria-label="Toggle disclaimer section">
            {openSections.disclaimer ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {openSections.disclaimer && (
          <>
            <p className="text-sm text-muted-foreground">
              Text to display when someone first comes to the app. Leave empty to show no disclaimer.
            </p>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Disclaimer</label>
              <textarea
                value={disclaimerText}
                disabled={settingsLoading || settingsSaving}
                onChange={(event) => setDisclaimerText(event.target.value)}
                placeholder="Enter disclaimer text..."
                className="w-full min-h-20 p-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-y"
                rows={4}
              />
              <div className="flex justify-end">
                <Button
                  disabled={settingsLoading || settingsSaving}
                  onClick={() => void updateSettings(saveResumeEnabled, autosaveTimeoutMs, disclaimerText)}
                >
                  Save
                </Button>
              </div>
            </div>
            {settingsSaving && <p className="text-sm text-muted-foreground">Saving setting...</p>}
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Save &amp; Resume</h2>
          <Button variant="ghost" onClick={() => toggleSection('save_resume')} aria-label="Toggle save and resume section">
            {openSections.save_resume ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {openSections.save_resume && (
          <>
            <p className="text-sm text-muted-foreground">
              Allow respondents to save survey progress, return from a resume link, and use autosave while completing a survey.
            </p>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Availability</label>
              <Select
                value={saveResumeEnabled ? 'enabled' : 'disabled'}
                disabled={settingsLoading || settingsSaving}
                onChange={(event) => {
                  void updateSettings(event.target.value === 'enabled', autosaveTimeoutMs, disclaimerText)
                }}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                When disabled, respondents can only complete surveys in a single session and any resume links stop working.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Autosave Interval</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1000"
                  max="300000"
                  step="1000"
                  value={autosaveTimeoutMs}
                  disabled={settingsLoading || settingsSaving || !saveResumeEnabled}
                  onChange={(event) => setAutosaveTimeoutMs(parseInt(event.target.value, 10) || 60000)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">milliseconds</span>
                <Button
                  disabled={settingsLoading || settingsSaving || !saveResumeEnabled}
                  onClick={() => void updateSettings(saveResumeEnabled, autosaveTimeoutMs, disclaimerText)}
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                How often to automatically save survey progress (minimum 1 second, maximum 5 minutes).
              </p>
            </div>
            {settingsSaving && <p className="text-sm text-muted-foreground">Saving setting...</p>}
            {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Seed Demo Data</h2>
          <Button variant="ghost" onClick={() => toggleSection('seed')} aria-label="Toggle seed demo data section">
            {openSections.seed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {openSections.seed && (
          <>
            <p className="text-sm text-muted-foreground">
              Add sample surveys and respondent users, including responses distributed over the last 14 days.
            </p>
            <div className="space-y-1">
              <label className="text-xs uppercase text-muted-foreground">Survey</label>
              <Select value={selectedSurveyId} onChange={(event) => setSelectedSurveyId(event.target.value)}>
                <option value="all">All published surveys</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Used by Seed Responses Only. Leave on All published surveys to distribute responses across every published survey.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runSeedAll} disabled={seedAction !== null}>
                {seedAction === 'all' ? 'Seeding...' : 'Surveys and Users'}
              </Button>
              <Button onClick={runSeedResponsesOnly} disabled={seedAction !== null} variant="secondary">
                {seedAction === 'responses' ? 'Seeding...' : 'Seed Responses Only'}
              </Button>
            </div>
            {seedSummary && (
              <p className="text-sm text-foreground">
                Seeded <Mono>{seedSummary.created_surveys}</Mono> surveys, <Mono>{seedSummary.created_users}</Mono>{' '}
                users, and <Mono>{seedSummary.created_responses}</Mono> responses.
              </p>
            )}
            {seedError && <p className="text-sm text-destructive">{seedError}</p>}
          </>
        )}
      </Card>
    </div>
  )
}
