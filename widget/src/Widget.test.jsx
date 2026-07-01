import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Widget from './Widget'

const emptyGeojson = { type: 'FeatureCollection', features: [] }

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    const file = url.split('/').pop()
    const responses = {
      'pois.geojson': emptyGeojson,
      'vias_primarias.geojson': emptyGeojson,
      'vias_secundarias.geojson': emptyGeojson,
      'hosp_esc_entret.geojson': emptyGeojson,
      'transporte_publico.geojson': emptyGeojson,
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(responses[file] || emptyGeojson) })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Widget', () => {
  it('shows loading state initially', () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    expect(screen.getByText(/Cargando datos/i)).toBeInTheDocument()
  })

  it('renders score after data loads', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
  })

  it('switches to drive tab', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /En Carro/i }))
    expect(screen.getByText(/Vehicular/i)).toBeInTheDocument()
  })

  it('shows location inputs with accessible labels', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await waitFor(() => expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/Latitud/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Longitud/i)).toBeInTheDocument()
  })
})
