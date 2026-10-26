import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

type MoleculeKey = 'water' | 'carbon' | 'methane'
type Atom = { id: string; element: 'O' | 'H' | 'C'; position: [number, number, number]; fact: string }
type Molecule = { formula: string; name: string; note: string; atoms: Atom[]; bonds: [number, number][] }

const molecules: Record<MoleculeKey, Molecule> = {
  water: {
    formula: 'H₂O',
    name: 'Water',
    note: 'Bent geometry · 104.5° bond angle',
    atoms: [
      { id: 'oxygen', element: 'O', position: [0, 0, 0], fact: 'Oxygen draws shared electrons closer, making water polar.' },
      { id: 'hydrogen-1', element: 'H', position: [-1.18, 0.91, 0], fact: 'Each hydrogen forms one covalent O–H bond.' },
      { id: 'hydrogen-2', element: 'H', position: [1.18, 0.91, 0], fact: 'The H–O–H angle is approximately 104.5°.' },
    ],
    bonds: [[0, 1], [0, 2]],
  },
  carbon: {
    formula: 'CO₂', name: 'Carbon dioxide', note: 'Linear geometry · 180°',
    atoms: [
      { id: 'carbon', element: 'C', position: [0, 0, 0], fact: 'Carbon forms two double bonds in this simplified model.' },
      { id: 'oxygen-1', element: 'O', position: [-1.55, 0, 0], fact: 'The two polar bonds cancel in this symmetric molecule.' },
      { id: 'oxygen-2', element: 'O', position: [1.55, 0, 0], fact: 'CO₂ is linear, with a 180° bond angle.' },
    ],
    bonds: [[0, 1], [0, 2]],
  },
  methane: {
    formula: 'CH₄', name: 'Methane', note: 'Tetrahedral geometry · 109.5°',
    atoms: [
      { id: 'carbon', element: 'C', position: [0, 0, 0], fact: 'Carbon makes four equivalent single covalent bonds.' },
      { id: 'h1', element: 'H', position: [1, 1, 1], fact: 'Methane has tetrahedral symmetry.' },
      { id: 'h2', element: 'H', position: [-1, -1, 1], fact: 'Ideal bond angles are approximately 109.5°.' },
      { id: 'h3', element: 'H', position: [-1, 1, -1], fact: 'Hydrogen shares one electron pair with carbon.' },
      { id: 'h4', element: 'H', position: [1, -1, -1], fact: 'CH₄ is a simplified ball-and-stick model here.' },
    ],
    bonds: [[0, 1], [0, 2], [0, 3], [0, 4]],
  },
}

const colors = { O: '#d9544d', H: '#f7f4eb', C: '#263640' }

function Bond({ a, b }: { a: Atom; b: Atom }) {
  const { mid, length, quaternion } = useMemo(() => {
    const start = new THREE.Vector3(...a.position)
    const end = new THREE.Vector3(...b.position)
    const direction = end.clone().sub(start)
    return {
      mid: start.clone().add(end).multiplyScalar(.5),
      length: direction.length(),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    }
  }, [a, b])
  return <mesh position={mid} quaternion={quaternion} castShadow>
    <cylinderGeometry args={[.095, .095, length, 16]} />
    <meshStandardMaterial color="#b9b4aa" roughness={.42} metalness={.08} />
  </mesh>
}

function Model({ data, paused, selected, onSelect, reset }: {
  data: Molecule; paused: boolean; selected: string | null; onSelect: (atom: Atom) => void; reset: number
}) {
  const group = useRef<THREE.Group>(null)
  const controls = useRef<any>(null)
  const interacting = useRef(false)
  useEffect(() => {
    if (group.current) group.current.rotation.set(.18, -.45, 0)
    controls.current?.reset()
  }, [reset, data])
  useFrame((_, delta) => {
    if (!paused && !interacting.current && group.current) group.current.rotation.y += delta * .18
  })
  return <>
    <group ref={group}>
      {data.bonds.map(([x, y]) => <Bond key={`${x}-${y}`} a={data.atoms[x]} b={data.atoms[y]} />)}
      {data.atoms.map(atom => {
        const active = atom.id === selected
        return <mesh
          key={atom.id} position={atom.position} castShadow receiveShadow
          scale={active ? 1.13 : 1}
          onClick={event => { event.stopPropagation(); onSelect(atom) }}
          onPointerOver={event => { event.stopPropagation(); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = 'default' }}
        >
          <sphereGeometry args={[atom.element === 'H' ? .38 : .58, 32, 32]} />
          <meshStandardMaterial color={colors[atom.element]} roughness={.28} metalness={.03} emissive={active ? '#0d9488' : '#000000'} emissiveIntensity={active ? .22 : 0} />
        </mesh>
      })}
    </group>
    <OrbitControls ref={controls} enablePan={false} minDistance={4.2} maxDistance={8} minPolarAngle={.55} maxPolarAngle={2.55}
      onStart={() => { interacting.current = true }} onEnd={() => { interacting.current = false }} />
  </>
}

class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <MoleculeFallback /> : this.props.children }
}

function MoleculeFallback() {
  return <div className="molecule-fallback" role="img" aria-label="Simplified water molecule fallback">
    <span className="fallback-atom oxygen">O</span><i className="bond left" /><i className="bond right" />
    <span className="fallback-atom hydrogen h-one">H</span><span className="fallback-atom hydrogen h-two">H</span>
    <p>3D view unavailable — simplified H₂O diagram</p>
  </div>
}

function MoleculeExperience() {
  const [kind, setKind] = useState<MoleculeKey>('water')
  const [selected, setSelected] = useState<Atom | null>(null)
  const [paused, setPaused] = useState(false)
  const [reset, setReset] = useState(0)
  const data = molecules[kind]
  return <div className="specimen">
    <div className="specimen-top"><span>Interactive specimen / 01</span><strong>{data.formula}</strong></div>
    <div className="canvas-wrap">
      <SceneBoundary>
        <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, .3, 5.8], fov: 42 }} gl={{ antialias: true, alpha: true }}>
          <color attach="background" args={['#eef0e9']} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[4, 6, 5]} intensity={2.4} castShadow />
          <directionalLight position={[-4, -2, 2]} intensity={.7} color="#b8e0dc" />
          <Suspense fallback={null}>
            <Model data={data} paused={paused} selected={selected?.id || null} onSelect={setSelected} reset={reset} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
      <span className="drag-hint">Drag to rotate · Pinch to zoom</span>
    </div>
    <div className="molecule-picker">
      {(Object.keys(molecules) as MoleculeKey[]).map(key =>
        <button className={kind === key ? 'active' : ''} key={key} onClick={() => { setKind(key); setSelected(null) }}>{molecules[key].formula}</button>
      )}
    </div>
    <div className="specimen-info">
      <div><small>MODEL</small><h3>{data.name}</h3><p>{data.note}</p></div>
      <div className="atom-fact" aria-live="polite"><small>SELECTED ATOM</small><p>{selected ? <><b>{selected.element}</b> — {selected.fact}</> : 'Select an atom to inspect it.'}</p></div>
    </div>
    <div className="scene-controls">
      <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume rotation' : 'Pause rotation'}</button>
      <button onClick={() => setReset(value => value + 1)}>Reset view</button>
    </div>
    <p className="model-note">Simplified educational ball-and-stick representations; not to scale.</p>
  </div>
}

function Header({ onDashboard }: { onDashboard: (view: 'tutor' | 'parent') => void }) {
  const [open, setOpen] = useState(false)
  return <header className="site-header">
    <a className="wordmark" href="#home" onClick={() => setOpen(false)}><span>K</span> Mystery Academy</a>
    <button className="menu-button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
    <nav className={open ? 'open' : ''} aria-label="Primary navigation">
      {['Home', 'About', 'Courses', 'Approach', 'Contact'].map(item => <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setOpen(false)}>{item}</a>)}
      <a className="nav-cta" href="#enroll" onClick={() => setOpen(false)}>Enrollment enquiry</a>
    </nav>
    <div hidden><button onClick={() => onDashboard('tutor')}>Tutor preview</button></div>
  </header>
}

const Field = ({ label, name, type = 'text', required = false, placeholder = '' }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) =>
  <label><span>{label}{required && ' *'}</span><input name={name} type={type} required={required} placeholder={placeholder} /></label>

function EnrollmentForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  if (status === 'success') return <div className="success" role="status"><span>✓</span><h3>Demo enquiry complete</h3><p>Your information was validated in this browser, but nothing was sent or stored. In a production service, this would continue to a secure confirmation step.</p><button onClick={() => setStatus('idle')}>Start another demo</button></div>
  return <form onSubmit={event => {
    event.preventDefault()
    setStatus('loading')
    window.setTimeout(() => setStatus('success'), 700)
  }}>
    <div className="form-grid">
      <Field label="Student name" name="student" required />
      <Field label="Parent / guardian name" name="parent" required />
      <Field label="Parent email" name="parentEmail" type="email" required />
      <Field label="Student email" name="studentEmail" type="email" />
      <Field label="Phone / WhatsApp" name="phone" type="tel" required />
      <Field label="Country" name="country" required />
      <Field label="Time zone" name="timezone" required placeholder="e.g. IST / GMT+4" />
      <Field label="Grade" name="grade" required />
      <Field label="Education board / curriculum" name="board" required />
      <Field label="State board details (if applicable)" name="stateBoard" />
      <Field label="Preferred class days" name="days" required placeholder="e.g. Tue, Thu" />
      <Field label="Preferred time slots" name="times" required placeholder="Include your time zone" />
      <label className="full"><span>Requirements or notes</span><textarea name="notes" rows={4} /></label>
    </div>
    <p className="privacy-note">Prototype only. Do not enter real personal or sensitive student information; this form does not transmit or store data.</p>
    <button className="primary-button" disabled={status === 'loading'} type="submit">{status === 'loading' ? 'Validating…' : 'Complete demo enquiry'}</button>
  </form>
}

function Home({ onDashboard }: { onDashboard: (view: 'tutor' | 'parent') => void }) {
  return <><Header onDashboard={onDashboard} /><main id="home">
    <section className="hero section-shell">
      <div className="hero-copy"><p className="eyebrow">Independent online chemistry tutoring</p><h1>Learn the logic<br />behind <em>chemistry.</em></h1>
        <p className="lede">A proposed learning studio by Anjana, designed to turn difficult concepts into clear, connected understanding.</p>
        <div className="hero-actions"><a className="primary-button" href="#courses">Explore courses</a><a className="text-link" href="#about">Meet your tutor <span>↘</span></a></div>
        <div className="hero-footnote"><b>01</b><span>Observe<br />Question<br />Connect</span><i /></div>
      </div>
      <MoleculeExperience />
    </section>

    <section id="about" className="about section-shell">
      <div className="section-index">01 / Tutor</div>
      <div className="portrait-placeholder"><span>Photograph placeholder</span><small>Genuine image of Anjana to be supplied</small></div>
      <div className="about-copy"><p className="eyebrow">About Anjana</p><h2>A thoughtful guide for every <em>“why?”</em></h2>
        <p>This space will introduce Anjana’s verified teaching background, chemistry expertise, and qualifications once supplied.</p>
        <blockquote>“Teaching philosophy statement to be provided by Anjana.”</blockquote>
        <dl><div><dt>Background</dt><dd>Client information required</dd></div><div><dt>Qualifications</dt><dd>Client information required</dd></div></dl>
      </div>
    </section>

    <section id="approach" className="approach">
      <div className="section-shell"><div className="section-heading"><div className="section-index">02 / Method</div><p className="eyebrow">Teaching approach</p><h2>From observation<br />to understanding.</h2></div>
      <ol className="approach-list">
        <li><span>01</span><div><h3>Diagnose the gap</h3><p>Begin with what the learner already understands, then isolate the precise point where a concept becomes unclear.</p></div><b>?</b></li>
        <li><span>02</span><div><h3>Build the mental model</h3><p>Use visual structure, worked reasoning, and chemical language to connect the microscopic and observable worlds.</p></div><b>⌬</b></li>
        <li><span>03</span><div><h3>Practise with purpose</h3><p>Move from guided examples to independent application, with feedback that explains—not just scores—the result.</p></div><b>→</b></li>
      </ol></div>
    </section>

    <section id="courses" className="courses section-shell">
      <div className="section-heading"><div className="section-index">03 / Curriculum</div><p className="eyebrow">Courses and curriculum</p><h2>A flexible structure,<br /><em>shaped around the learner.</em></h2><p>These are sample programme structures for the prototype. Final names, grade ranges, curricula, schedules, and fees will be confirmed by the academy.</p></div>
      <div className="course-table">
        {sampleCourses.map((course, i) => <article key={course.title}>
          <span>0{i + 1}</span><div><small>Sample programme</small><h3>{course.title}</h3><p>{course.summary}</p>
          <ul><li>{course.level}</li><li>{course.curriculum}</li><li>{course.focus}</li></ul></div><a href="#enroll">Enquire <b>→</b></a>
        </article>)}
      </div>
    </section>

    <section className="testimonials section-shell"><div className="section-index">04 / Voices</div><div><p className="eyebrow">Student and parent feedback</p><h2>What thoughtful support<br /><em>could sound like.</em></h2><p className="sample-disclaimer">The examples shown here are fictional prototype copy—not real testimonials or outcome claims. They demonstrate the intended tone until approved feedback is supplied.</p></div>
      <div className="feedback-list">{sampleFeedback.map((item, index) => <article className="quote-placeholder" key={item.quote}><span>“</span><p>{item.quote}</p><small>0{index + 1} · {item.byline}</small></article>)}</div>
    </section>

    <section id="enroll" className="enroll"><div className="section-shell"><div className="enroll-intro"><p className="eyebrow">Enrollment enquiry demo</p><h2>Start with a<br />clearer question.</h2><p>Explore how a future enquiry flow could work. This prototype validates inputs locally and does not contact the tutor.</p></div><EnrollmentForm /></div></section>

    <section id="contact" className="contact section-shell"><p className="eyebrow">Contact</p><h2>Ready to discuss<br />the right next step?</h2><p>Email and phone / WhatsApp details to be supplied by the academy.</p><a href="#enroll" className="primary-button">Open enquiry form</a></section>
  </main><Footer onDashboard={onDashboard} /></>
}

function Footer({ onDashboard }: { onDashboard: (view: 'tutor' | 'parent') => void }) {
  return <footer><div className="wordmark"><span>K</span> Mystery Academy</div><p>Independent online Chemistry tutoring · Details pending client confirmation.</p>
    <div><button onClick={() => onDashboard('tutor')}>Tutor dashboard preview</button><button onClick={() => onDashboard('parent')}>Parent / student preview</button></div>
    <nav><a href="#home">Back to top</a><span>Privacy placeholder</span><span>Terms placeholder</span></nav></footer>
}

const demoStudents = [
  { name: 'Maya Rao', grade: 'Grade 10 · Demo Board', attendance: '92%', progress: 74 },
  { name: 'Arjun Menon', grade: 'Grade 12 · Demo Curriculum', attendance: '88%', progress: 61 },
  { name: 'Leah Thomas', grade: 'Grade 9 · Demo Board', attendance: '96%', progress: 82 },
]

const sampleCourses = [
  {
    title: 'Chemistry foundations',
    summary: 'A concept-first pathway for learners who want to strengthen atomic structure, bonding, equations, and quantitative reasoning.',
    level: 'Example: Grades 8–10',
    curriculum: 'Adaptable to the learner’s board',
    focus: 'Weekly concept practice',
  },
  {
    title: 'Exam preparation',
    summary: 'Structured revision built around topic diagnosis, worked problems, timed practice, and specific feedback on common errors.',
    level: 'Example: Grades 10–12',
    curriculum: 'Board details confirmed at enquiry',
    focus: 'Targeted revision plan',
  },
  {
    title: 'Concept clinic',
    summary: 'Short, focused support for a difficult chapter—from mole calculations and equilibrium to organic reaction patterns.',
    level: 'Flexible grade level',
    curriculum: 'Topic-led support',
    focus: 'Focused learning block',
  },
]

const sampleFeedback = [
  {
    quote: 'The diagrams and step-by-step questions helped me see why the equation worked instead of simply memorising it.',
    byline: 'Illustrative student voice · fictional prototype content',
  },
  {
    quote: 'The lesson summary made it easy to understand what had improved and what we should practise before the next class.',
    byline: 'Illustrative parent voice · fictional prototype content',
  },
  {
    quote: 'Breaking equilibrium into particle-level changes made a topic I avoided feel much more manageable.',
    byline: 'Illustrative student voice · fictional prototype content',
  },
]

function Dashboard({ type, onHome }: { type: 'tutor' | 'parent'; onHome: () => void }) {
  const [student, setStudent] = useState(0)
  const [tab, setTab] = useState('Overview')
  const active = demoStudents[student]
  const tabs = type === 'tutor' ? ['Overview', 'Attendance', 'Assessments', 'Notes'] : ['Overview', 'Classes', 'Results', 'Feedback']
  return <div className="dashboard">
    <aside><div className="wordmark"><span>K</span> MA</div><small>DEMONSTRATION PREVIEW</small>{tabs.map(item => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}<button onClick={onHome}>← Public website</button></aside>
    <main><header><div><p className="eyebrow">{type === 'tutor' ? 'Tutor workspace' : 'Parent / student portal'}</p><h1>{type === 'tutor' ? 'Good morning, Anjana.' : active.name}</h1></div><span>Preview · Fictional records</span></header>
      {type === 'tutor' && <div className="student-tabs">{demoStudents.map((person, index) => <button className={student === index ? 'active' : ''} onClick={() => setStudent(index)} key={person.name}>{person.name}</button>)}</div>}
      <section className="dash-grid">
        <article className="student-card"><small>STUDENT PROFILE</small><h2>{active.name}</h2><p>{active.grade}</p><dl><div><dt>Enrollment</dt><dd>Demo active</dd></div><div><dt>Attendance</dt><dd>{active.attendance}</dd></div><div><dt>Payment status</dt><dd>Demo: up to date</dd></div></dl></article>
        <article><small>UPCOMING CLASS</small><h3>Atomic structure & periodicity</h3><p>Tuesday · 4:30 PM (demo time)</p><button>View class details</button></article>
        <article><small>PROGRESS OVERVIEW</small><h3>{active.progress}%</h3><div className="progress"><i style={{ width: `${active.progress}%` }} /></div><p>Illustrative progress only—this is not a real student result.</p></article>
        <article><small>LATEST ASSESSMENT</small><h3>Bonding concepts</h3><p>Demo mark: 18 / 25</p><button>{type === 'tutor' ? 'Enter marks' : 'View result'}</button></article>
        <article className="wide"><small>{type === 'tutor' ? 'TEACHER NOTES' : 'TEACHER FEEDBACK'}</small><h3>Strong conceptual questions this week.</h3><p>Demo note: revisit electron configuration before the next lesson. All records on this screen are fictional and stored only in this interface.</p>{type === 'tutor' && <textarea aria-label="Demo feedback note" defaultValue="Continue with short retrieval exercises." />}</article>
      </section>
    </main>
  </div>
}

export default function App() {
  const [view, setView] = useState<'home' | 'tutor' | 'parent'>('home')
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])
  return view === 'home' ? <Home onDashboard={setView} /> : <Dashboard type={view} onHome={() => setView('home')} />
}
