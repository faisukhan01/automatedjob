#!/usr/bin/env python3
"""Builds a minimal valid .docx resume for testing the import API."""
import zipfile

paragraphs = [
    "Sana Riaz",
    "Product Designer & Frontend Developer",
    "sana.riaz@example.com | +971 50 987 6543 | Dubai, UAE",
    "",
    "PROFILE",
    "Designer-developer hybrid with 5 years of experience crafting design systems,",
    "marketing sites and React applications for fintech and e-commerce startups.",
    "",
    "SKILLS",
    "Figma, React, TypeScript, Tailwind CSS, Next.js, HTML, CSS, Sass,",
    "Framer Motion, Storybook, Git, Accessibility",
    "",
    "EXPERIENCE",
    "Senior Product Designer - GulfPay (2022 - Present)",
    "Own the design system and ship React components with the platform team.",
    "",
    "UI Engineer - MarketHub (2020 - 2022)",
    "Built the storefront in Next.js and improved Lighthouse scores to 98.",
]

body = ""
for p in paragraphs:
    body += f'<w:p><w:r><w:t xml:space="preserve">{p}</w:t></w:r></w:p>'

document = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    f"<w:body>{body}</w:body></w:document>"
)

ct = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    "</Types>"
)

rels = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    "</Relationships>"
)

with zipfile.ZipFile("/home/z/my-project/upload/test/test-resume.docx", "w") as z:
    z.writestr("[Content_Types].xml", ct)
    z.writestr("_rels/.rels", rels)
    z.writestr("word/document.xml", document)

print("DOCX written")
