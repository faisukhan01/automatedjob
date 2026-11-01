import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'

async function gen(prompt: string, size: string, out: string) {
  const zai = await ZAI.create()
  const res = await zai.images.generations.create({ prompt, size })
  fs.writeFileSync(out, Buffer.from(res.data[0].base64, 'base64'))
  console.log('saved', out, size)
}

const banner =
  'Premium dark technology banner, deep charcoal black background with emerald green gradient glow, an abstract glowing rocket trajectory arcing upward connecting network nodes and document icons, futuristic minimal tech aesthetic, soft particles, elegant wide composition, cinematic lighting, high quality, no text, no letters'
const logo =
  'Minimal flat vector logo icon of a paper airplane merged with a rocket, emerald green gradient on very dark charcoal rounded square background, clean modern SaaS app icon style, centered, no text'

await gen(banner, '1408x704', './docs/banner.png')
await gen(logo, '1024x1024', './docs/logo.png')
