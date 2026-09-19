import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const GATEWAY_ORIGIN = API.replace(/\/api$/, '')

function ProgressBar({ stages = [], currentStage = 0 }) {
  const safeStage = Math.max(0, Math.min(Number(currentStage) || 0, stages.length - 1))
  return (
    <div className="dept-bar-wrap">
      <div className="dept-bars">
        {stages.map((stage, i) => (
          <div key={`${stage}-${i}`} className={`dept-bar ${i < safeStage ? 'done' : i === safeStage ? 'current' : 'pending'}`} title={stage} />
        ))}
      </div>
      <div className="dept-stage-label">{stages[safeStage] || 'Pending'}</div>
    </div>
  )
}

function formatShort(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatLong(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Splits the window between createdAt and estCompletion evenly across the
// stage list so every application gets a per-stage date range, even though
// the backend only stores a single start date and a single target date.
function buildStageSchedule(stages, createdAt, estCompletion) {
  const start = createdAt ? new Date(createdAt) : null
  const end = estCompletion && estCompletion !== 'TBD' ? new Date(estCompletion) : null
  if (!start || !end || isNaN(start) || isNaN(end) || end <= start || !stages.length) return null
  const perStageMs = (end.getTime() - start.getTime()) / stages.length
  const DAY = 86400000
  return stages.map((_, i) => {
    const segStart = new Date(start.getTime() + i * perStageMs)
    const segEnd = new Date(start.getTime() + (i + 1) * perStageMs - (i === stages.length - 1 ? 0 : DAY))
    return { start: segStart, end: segEnd <= segStart ? segStart : segEnd }
  })
}

function formatRange(seg) {
  const sameDay = seg.start.toDateString() === seg.end.toDateString()
  return sameDay ? formatShort(seg.start) : `${formatShort(seg.start)}–${formatShort(seg.end)}`
}

function daysBetween(a, b) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

// Human line for a single stage: how long it's expected to take, or — for
// the stage in progress right now — how much of that time is left.
function stageTimeNote(seg, status) {
  if (!seg) return null
  const now = new Date()
  if (status === 'done') return null
  if (status === 'current') {
    const left = daysBetween(now, seg.end)
    return left <= 0 ? 'Due today' : `${left} day${left === 1 ? '' : 's'} left`
  }
  const span = Math.max(1, daysBetween(seg.start, seg.end))
  return `~${span} day${span === 1 ? '' : 's'} once reached`
}

function Timeline({ data }) {
  const { stages = [], currentStage = 0, createdAt, estCompletion } = data
  if (!stages.length) return null
  const safeStage = Math.max(0, Math.min(Number(currentStage) || 0, stages.length - 1))
  const isDone = safeStage >= stages.length - 1 && stages.length > 0
  const schedule = buildStageSchedule(stages, createdAt, estCompletion)
  const endDate = estCompletion && estCompletion !== 'TBD' ? new Date(estCompletion) : null
  const validEnd = endDate && !isNaN(endDate)
  const daysRemaining = validEnd ? Math.ceil((endDate - new Date()) / 86400000) : null

  return (
    <div className="timeline">
      <div className="timeline-track">
        {stages.map((label, i) => {
          const status = i < safeStage ? 'done' : i === safeStage ? 'current' : 'pending'
          const seg = schedule ? schedule[i] : null
          const note = seg ? stageTimeNote(seg, status) : null
          return (
            <div className={`timeline-stage ${status}`} key={`${label}-${i}`}>
              <div className="timeline-icon">{status === 'done' ? '✓' : status === 'current' ? '●' : '○'}</div>
              <div className="timeline-label">{label}</div>
              {seg && <div className="timeline-date">{formatRange(seg)}</div>}
              <div className="timeline-status">{status === 'done' ? 'Completed' : status === 'current' ? 'CURRENT' : 'Pending'}</div>
              {note && <div className="timeline-note">{note}</div>}
            </div>
          )
        })}
      </div>
      <div className="timeline-footer">
        <div><span>Current stage:</span>{stages[safeStage] || '—'}</div>
        <div><span>Estimated time remaining:</span>{isDone ? 'Completed' : !validEnd ? 'TBD' : daysRemaining <= 0 ? 'Due today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`}</div>
        <div><span>Expected completion:</span>{validEnd ? formatLong(endDate) : 'TBD'}</div>
      </div>
    </div>
  )
}


function ServiceRow({ data }) {
  if (!data) return <div className="empty-service">No application found in this department.</div>
  return (
    <div className="dept-block">
      <div className="dept-name">{data.department}</div>
      <Timeline data={data} />
      {(data.documentUrl || data.remarks) && (
        <div className="dept-extra">
          {data.documentUrl && <a className="doc-link" href={`${GATEWAY_ORIGIN}${data.documentUrl}`} target="_blank" rel="noreferrer">View uploaded document</a>}
          {data.remarks && <p className="dept-remarks">{data.remarks}</p>}
        </div>
      )}
    </div>
  )
}

function classifyQuery(text) {
  const lower = text.toLowerCase()
  const keywords = {
    license: ['license', 'trade license', 'permit'],
    landRecords: ['land', 'survey', 'property', 'plot'],
    tax: ['tax', 'gst', 'revenue', 'return']
  }
  for (const [department, words] of Object.entries(keywords)) {
    if (words.some(word => lower.includes(word))) return department
  }
  return null
}

function QueryRouter({ dashboardData, onLog }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const handleAsk = () => {
    if (!query.trim()) return
    const dept = classifyQuery(query)
    setResult(dept)
    onLog(`Query "${query}" routed to ${dept || 'no matching department'}`)
  }
  const deptData = dashboardData?.services?.[result]
  return (
    <div className="panel">
      <h3>Ask a service question</h3>
      <input className="field" placeholder='"where is my land record?"' value={query} onChange={e => setQuery(e.target.value)} />
      <button className="btn btn-outline" onClick={handleAsk}>Ask</button>
      {result && deptData && <div className="routed-to">Routed to <strong>{deptData.department}</strong><ProgressBar stages={deptData.stages} currentStage={deptData.currentStage} /></div>}
      {result && !deptData && <p className="result-msg err">Detected {result}, but no record is loaded for this citizen.</p>}
      {result === null && query && <p className="result-msg err">Try a question containing license, land, survey, property, tax, GST or revenue.</p>}
    </div>
  )
}

function NewServiceRequest({ citizen, token, onSubmitted, onLog }) {
  const [department, setDepartment] = useState('license')
  const [fieldValue, setFieldValue] = useState('')
  const [remarks, setRemarks] = useState('')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const labels = { license: 'Application Type', landRecords: 'Survey Number (e.g. 4521 or SN-4521)', tax: 'Tax Type' }
  const keys = { license: 'applicationType', landRecords: 'surveyNumber', tax: 'taxType' }

  const handleFileChange = e => {
    const f = e.target.files?.[0] || null
    if (f && f.size > 5 * 1024 * 1024) { setResult({ error: 'File must be under 5 MB.' }); e.target.value = ''; setFile(null); return }
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!citizen || !fieldValue.trim()) {
      setResult({ error: 'Please complete the application details.' })
      return
    }
    setSubmitting(true); setResult(null)
    try {
      let documentUrl = null
      if (file) {
        const form = new FormData()
        form.append('document', file)
        const uploadRes = await fetch(`${API}/citizen/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) { setResult({ error: uploadData.error || 'Document upload failed.' }); setSubmitting(false); return }
        documentUrl = uploadData.documentUrl
      }
      const response = await fetch(`${API}/citizen/apply`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ department, citizenId: citizen.citizenId, ownerName: citizen.name, [keys[department]]: fieldValue.trim(), documentUrl, remarks: remarks.trim() })
      })
      const data = await response.json()
      setResult(data)
      if (response.ok) { onLog(`New ${department} application submitted — ID ${data.applicationId}`); setFieldValue(''); setRemarks(''); setFile(null); onSubmitted() }
    } catch { setResult({ error: 'Gateway unavailable. Start all backend services.' }) }
    setSubmitting(false)
  }

  return (
    <div className="panel">
      <h3>New service request</h3>
      <div className="master-chip">Citizen profile: <strong>{citizen?.name}</strong> · ID {citizen?.citizenId}</div>
      <select className="field" value={department} onChange={e => { setDepartment(e.target.value); setFieldValue(''); setResult(null) }}>
        <option value="license">License Dept</option><option value="landRecords">Land Records Dept</option><option value="tax">Tax & Revenue Dept</option>
      </select>
      <input className="field" placeholder={labels[department]} value={fieldValue} onChange={e => setFieldValue(e.target.value)} />
      <textarea className="field" placeholder="Additional details / remarks (optional)" rows="3" value={remarks} onChange={e => setRemarks(e.target.value)} />
      <label className="upload-label">Supporting document (PDF, JPG or PNG, max 5 MB)</label>
      <input className="field" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
      {file && <p className="hint">Selected: {file.name}</p>}
      <button className="btn" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit request'}</button>
      {result && <p className={`result-msg ${result.error ? 'err' : 'ok'}`}>{result.error || `Submitted — Application ID ${result.applicationId}`}</p>}
    </div>
  )
}

function StatCards({ stats }) {
  if (!stats) return null
  return <div className="stat-grid">
    <div className="stat-card"><span>Total applications</span><strong>{stats.total}</strong></div>
    <div className="stat-card"><span>License</span><strong>{stats.byDepartment.license || 0}</strong></div>
    <div className="stat-card"><span>Land Records</span><strong>{stats.byDepartment.landRecords || 0}</strong></div>
    <div className="stat-card"><span>Tax & Revenue</span><strong>{stats.byDepartment.tax || 0}</strong></div>
  </div>
}

function OfficerView({ token, onLog }) {
  const [applications, setApplications] = useState([])
  const [stats, setStats] = useState(null)
  const [workflows, setWorkflows] = useState({})
  const [selectedDept, setSelectedDept] = useState('license')
  const [stageText, setStageText] = useState('')
  const [filter, setFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [health, setHealth] = useState(null)
  const [events, setEvents] = useState([])
  const [audit, setAudit] = useState([])
  const [connector, setConnector] = useState(null)

  const headers = { Authorization: `Bearer ${token}` }
  const load = async () => {
    try {
      const [a, s, w, h, e, au] = await Promise.all([
        fetch(`${API}/officer/applications`, { headers }), fetch(`${API}/officer/stats`, { headers }), fetch(`${API}/workflows`, { headers }),
        fetch(`${API}/officer/health`, { headers }), fetch(`${API}/officer/events`, { headers }), fetch(`${API}/officer/audit`, { headers })
      ])
      const ad = await a.json(), sd = await s.json(), wd = await w.json(), hd = await h.json(), ed = await e.json(), aud = await au.json()
      if (h.ok) setHealth(hd.services || null)
      if (e.ok) setEvents(ed.events || [])
      if (au.ok) setAudit(aud.audit || [])
      if (a.ok) setApplications(ad.applications || [])
      if (s.ok) setStats(sd)
      if (w.ok) { setWorkflows(wd.workflows || {}); setStageText((wd.workflows?.[selectedDept] || []).join('\n')) }
    } catch { setMessage('Could not connect to Gateway.') }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setStageText((workflows[selectedDept] || []).join('\n')) }, [selectedDept, workflows])

  const filtered = useMemo(() => filter === 'all' ? applications : applications.filter(a => a.department === filter), [applications, filter])

  const updateStage = async (app, stage) => {
    const response = await fetch(`${API}/officer/applications/${app.department}/${app.applicationId}/stage`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ stage })
    })
    const data = await response.json()
    setMessage(response.ok ? `Updated ${app.applicationId} to ${app.stages[stage]}.` : data.error)
    if (response.ok) { onLog(`Officer updated ${app.applicationId} stage`); load() }
  }

  const saveWorkflow = async () => {
    const stages = stageText.split('\n').map(s => s.trim()).filter(Boolean)
    const response = await fetch(`${API}/workflows/${selectedDept}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ stages }) })
    const data = await response.json()
    setMessage(response.ok ? 'Workflow saved successfully.' : data.error)
    if (response.ok) { onLog(`Workflow updated for ${selectedDept}`); load() }
  }

  return <div className="officer-space">
    <div className="section-label">OFFICER MONITORING DASHBOARD</div>
    <StatCards stats={stats} />
    {health && <div className="panel"><h3>Live service health</h3><div className="stat-grid">{Object.entries(health).map(([name, v]) => <div className="stat-card" key={name}><span>{name}</span><strong>{v.status === 'online' ? '● ONLINE' : '● OFFLINE'}</strong><small>{v.responseTimeMs} ms</small></div>)}</div></div>}
    <div className="officer-grid">
      <div className="panel wide-panel">
        <div className="panel-heading"><h3>All citizen applications</h3><select className="small-select" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All departments</option><option value="license">License</option><option value="landRecords">Land Records</option><option value="tax">Tax & Revenue</option></select></div>
        <div className="table-wrap"><table><thead><tr><th>Application</th><th>Citizen</th><th>Department</th><th>Stage</th><th>Document</th><th>Action</th></tr></thead><tbody>
          {filtered.map(app => <tr key={`${app.department}-${app.applicationId}`}><td><strong title={app.remarks || ''}>{app.applicationId}</strong><small>{app.ownerName}</small></td><td>{app.citizenId}</td><td>{app.department === 'landRecords' ? 'Land Records' : app.department === 'license' ? 'License' : 'Tax & Revenue'}</td><td><span className="stage-pill">{app.stages[app.currentStage] || 'Pending'}</span></td><td>{app.documentUrl ? <a className="doc-link" href={`${GATEWAY_ORIGIN}${app.documentUrl}`} target="_blank" rel="noreferrer">View</a> : <span className="hint">None</span>}</td><td><select className="small-select" value={app.currentStage} onChange={e => updateStage(app, Number(e.target.value))}>{app.stages.map((stage, i) => <option key={stage} value={i}>{stage}</option>)}</select></td></tr>)}
          {filtered.length === 0 && <tr><td colSpan="6" className="empty-cell">No applications found.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="panel workflow-panel">
        <h3>Configurable workflow</h3>
        <p className="hint">One stage per line. Officers can adapt the workflow without changing the React UI.</p>
        <select className="field" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}><option value="license">License Dept</option><option value="landRecords">Land Records Dept</option><option value="tax">Tax & Revenue Dept</option></select>
        <textarea className="workflow-editor" value={stageText} onChange={e => setStageText(e.target.value)} rows="8" />
        <button className="btn" onClick={saveWorkflow}>Save workflow</button>
        {message && <p className="result-msg ok">{message}</p>}
      </div>
    </div>
    <div className="officer-grid">
      <div className="panel"><h3>Event stream</h3>{events.slice(0,8).map(e => <div className="log-entry" key={e.id}><span className="log-time">{new Date(e.timestamp).toLocaleTimeString()}</span><span><strong>{e.type}</strong> · {e.applicationId || 'system'}</span></div>)}{events.length === 0 && <p className="hint">No events yet. Submit or update an application.</p>}</div>
      <div className="panel"><h3>Audit trail</h3>{audit.slice(0,8).map(e => <div className="log-entry" key={e.id}><span className="log-time">{new Date(e.timestamp).toLocaleTimeString()}</span><span>{e.action} · {e.applicationId || e.role || 'system'}</span></div>)}{audit.length === 0 && <p className="hint">No audit records yet.</p>}</div>
    </div>
    <div className="panel"><h3>Interoperability connectors</h3><button className="btn btn-outline" onClick={async () => { const r = await fetch(`${API}/connectors/legacy-land/demo`, { headers }); const d = await r.json(); setConnector(d) }}>Test legacy Land connector</button>{connector && <pre className="connector-output">{JSON.stringify(connector, null, 2)}</pre>}</div>
  </div>
}

function App() {
  const [mode, setMode] = useState('login')
  const [role, setRole] = useState('citizen')
  const [citizenId, setCitizenId] = useState('123')
  const [token, setToken] = useState('')
  const [citizen, setCitizen] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [activityLog, setActivityLog] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [consentGiven, setConsentGiven] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [ssoInfo, setSsoInfo] = useState(null)

  const verifySso = async () => {
    try {
      const response = await fetch(`${API}/auth/whoami`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      setSsoInfo(response.ok ? data : { error: data.error })
      logActivity(response.ok ? 'Verified SSO token via /api/auth/whoami' : 'SSO verification failed')
    } catch { setSsoInfo({ error: 'Gateway unavailable.' }) }
  }

  const logActivity = action => setActivityLog(prev => [{ time: new Date().toLocaleTimeString(), action }, ...prev].slice(0, 30))

  const login = async () => {
    setLoading(true); setLoginError('')
    try {
      const response = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, citizenId: role === 'citizen' ? citizenId.trim() : undefined }) })
      const data = await response.json()
      if (!response.ok) { setLoginError(data.error || 'Login failed'); setLoading(false); return }
      setToken(data.token); setCitizen(role === 'citizen' ? { ...data.citizen, token: data.token } : data.citizen); setMode(role); logActivity(`Logged in through Gateway as ${role}`)
      if (role === 'citizen') setConsentGiven(false)
    } catch { setLoginError('Gateway unavailable. Start the backend services first.') }
    setLoading(false)
  }

  const fetchDashboard = async () => {
    if (!token || !citizen || !consentGiven) return
    setLoading(true)
    try {
      const response = await fetch(`${API}/citizen/${citizen.citizenId}/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      const notificationResponse = await fetch(`${API}/citizen/${citizen.citizenId}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await response.json()
      const notificationData = await notificationResponse.json()
      if (!response.ok) { setLoginError(data.error || 'Could not load dashboard'); setLoading(false); return }
      if (dashboardData) {
        const changes = Object.entries(data.services || {}).flatMap(([dept, service]) => {
          const old = dashboardData.services?.[dept]
          return old && old.currentStage !== service.currentStage ? [`${service.department}: ${old.stages?.[old.currentStage] || old.currentStage} → ${service.stages?.[service.currentStage] || service.currentStage}`] : []
        })
        if (changes.length) setNotifications(changes)
      }
      setDashboardData(data)
      if (notificationResponse.ok) setNotifications(notificationData.notifications || [])
      logActivity(`Fetched dashboard for Citizen ID ${citizen.citizenId}`)
    } catch { setLoginError('Could not connect to Gateway.') }
    setLoading(false)
  }

  const logout = async () => {
    if (token) fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setMode('login'); setToken(''); setCitizen(null); setDashboardData(null); setConsentGiven(false); setLoginError(''); logActivity('Logged out')
  }

  useEffect(() => { if (mode === 'citizen' && citizen && consentGiven) fetchDashboard() }, [consentGiven])

  if (mode === 'login') return <div className="app login-app">
    <div className="brand-mark">UCD</div><h1>Unified Citizen Desk</h1><p className="subtitle">One secure gateway for citizen services across departments.</p>
    <div className="login-card">
      <div className="role-switch"><button className={role === 'citizen' ? 'active' : ''} onClick={() => setRole('citizen')}>Citizen view</button><button className={role === 'officer' ? 'active' : ''} onClick={() => setRole('officer')}>Officer view</button></div>
      {role === 'citizen' ? <><label>Citizen ID</label><input className="field" value={citizenId} onChange={e => setCitizenId(e.target.value)} placeholder="e.g. 123" /><p className="hint">Demo IDs: 123, 124, 125</p></> : <div className="officer-login-note"><strong>Officer / Admin demo</strong><p>This prototype uses a simplified federated login. In production this can be replaced with OAuth 2.0 / OpenID Connect.</p></div>}
      <button className="btn full-btn" onClick={login} disabled={loading}>{loading ? 'Signing in…' : `Sign in as ${role}`}</button>
      {loginError && <p className="result-msg err">{loginError}</p>}
    </div>
  </div>

  return <div className="app">
    <header className="topbar"><div><h1>Unified Citizen Desk</h1><p className="subtitle">Gateway-connected government service portal</p></div><div className="user-area"><span className="role-badge">{role === 'officer' ? 'OFFICER' : `CITIZEN · ${citizen?.citizenId}`}</span><span className="sso-badge" title="One signed token authenticates this session across every department service">SSO</span><button className="text-btn" onClick={verifySso}>Verify SSO</button><button className="text-btn" onClick={logout}>Logout</button></div></header>
    {ssoInfo && <div className={`sso-panel ${ssoInfo.error ? 'err' : ''}`}>
      {ssoInfo.error ? <span>{ssoInfo.error}</span> : <span>Same token verified independently by the Gateway · role <strong>{ssoInfo.role}</strong>{ssoInfo.citizenId ? ` · citizen ${ssoInfo.citizenId}` : ''} · expires {new Date(ssoInfo.expiresAt).toLocaleTimeString()}</span>}
      <button className="text-btn" onClick={() => setSsoInfo(null)}>Dismiss</button>
    </div>}
    {mode === 'officer' ? <OfficerView token={token} onLog={logActivity} /> : <>
      {notifications.length > 0 && <div className="notice"><strong>Notifications</strong>{notifications.slice(0,6).map((n, i) => <div className="change-line" key={n.id || i}>{typeof n === 'string' ? n : n.message}</div>)}<button onClick={async () => { try { await fetch(`${API}/citizen/${citizen.citizenId}/notifications/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }) } catch (_) {} setNotifications([]) }}>Dismiss</button></div>}
      <div className="profile-banner"><div><span className="section-label">MASTER CITIZEN PROFILE</span><strong>{citizen?.name}</strong><span>Citizen ID {citizen?.citizenId}</span></div><span className="secure-badge">Gateway session active</span></div>
      <label className="consent"><input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} />I consent to share my data across departments for unified tracking</label>
      <div className="id-row"><input className="field" value={citizen?.citizenId || ''} readOnly /><button className="btn" onClick={fetchDashboard} disabled={!consentGiven}>{loading ? 'Loading…' : 'Refresh dashboard'}</button></div>
      {loginError && <p className="result-msg err">{loginError}</p>}
      {dashboardData && <><hr className="divider" /><div className="section-label">DEPARTMENT STATUS</div><ServiceRow data={dashboardData.services?.license} /><ServiceRow data={dashboardData.services?.landRecords} /><ServiceRow data={dashboardData.services?.tax} /></>}
      <hr className="divider" /><div className="panel-row"><NewServiceRequest citizen={citizen} token={token} onSubmitted={fetchDashboard} onLog={logActivity} /><QueryRouter dashboardData={dashboardData} onLog={logActivity} /></div>
      {activityLog.length > 0 && <><hr className="divider" /><div className="section-label">ACTIVITY / AUDIT LOG</div>{activityLog.map((entry, i) => <div className="log-entry" key={i}><span className="log-time">{entry.time}</span><span>{entry.action}</span></div>)}</>}
    </>}
  </div>
}

export default App
