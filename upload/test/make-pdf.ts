// Builds a minimal-but-valid text-based PDF resume for testing the import API
const lines = [
  'Bilal Ahmed Khan',
  'Senior Full-Stack Engineer',
  'bilal.ahmed@example.com | +92 300 1234567 | Karachi, Pakistan',
  '',
  'SUMMARY',
  'Full-stack engineer with 7 years of experience building SaaS platforms,',
  'automation systems and AI-powered products. Comfortable owning features',
  'end to end across React frontends and Python or Node backends.',
  '',
  'SKILLS',
  'TypeScript, JavaScript, React, Next.js, Node.js, Python, FastAPI,',
  'PostgreSQL, MongoDB, Docker, AWS, Redis, GraphQL, REST API, Git, Linux',
  '',
  'EXPERIENCE',
  'Senior Software Engineer — NovaLabs (2021 - Present)',
  'Led the migration of a monolith to microservices on AWS.',
  '',
  'Software Engineer — PixelForge (2018 - 2021)',
  'Built dashboards with React and FastAPI used by 40k users.',
  '',
  'EDUCATION',
  'BS Computer Science — NED University (2014 - 2018)',
]

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
let content = ''
let y = 780
for (const line of lines) {
  content += `BT /F1 11 Tf 50 ${y} Td (${esc(line)}) Tj ET\n`
  y -= 16
}
const objects = []
objects.push('<< /Type /Catalog /Pages 2 0 R >>')
objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>')
objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

let pdf = '%PDF-1.4\n'
const offsets = [0]
objects.forEach((body, i) => {
  offsets.push(pdf.length)
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
})
const xrefStart = pdf.length
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
for (let i = 1; i <= objects.length; i++) {
  pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n'
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

await Bun.write('/home/z/my-project/upload/test/test-resume.pdf', pdf)
console.log('PDF written:', pdf.length, 'bytes')
