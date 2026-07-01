import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculateScores } from '../src/utils/scoring.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../public/data')

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))

const runDebug = () => {
  const data = {
    pois: readJson('pois.geojson'),
    primaryRoads: readJson('vias_primarias.geojson'),
    secondaryRoads: readJson('vias_secundarias.geojson'),
    hospEscEntret: readJson('hosp_esc_entret.geojson'),
    publicTransport: readJson('transporte_publico.geojson'),
  }

  const location = { lat: 4.656, lng: -74.056 }
  const result = calculateScores(location, data)

  console.log('--- SCORING DEBUG ---')
  console.log(JSON.stringify(result.scores, null, 2))
  console.log('\n--- INSIGHTS ---')
  result.insights.forEach((i) => console.log(`[${i.type}] ${i.category}: ${i.text}`))
}

runDebug()
