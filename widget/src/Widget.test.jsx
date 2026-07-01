import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    // Keep the component in a loading state so the pending fetch does not
    // trigger an out-of-act state update after the test finishes.
    global.fetch = vi.fn(() => new Promise(() => {}))
    render(<Widget lat={4.656} lng={-74.056} />)
    expect(screen.getByText(/Cargando datos/i)).toBeInTheDocument()
  })

  it('renders score after data loads', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    expect(await screen.findByText(/Puntaje General/i)).toBeInTheDocument()
  })

  it('switches to drive tab', async () => {
    const user = userEvent.setup()
    render(<Widget lat={4.656} lng={-74.056} />)
    expect(await screen.findByText(/Puntaje General/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /En Carro/i }))
    expect(screen.getByText(/Vehicular/i)).toBeInTheDocument()
  })

  it('shows location inputs with accessible labels', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)
    expect(screen.getByLabelText(/Latitud/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Longitud/i)).toBeInTheDocument()
  })

  it('renders tab list and tab panels with correct accessibility attributes', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    const tablist = screen.getByRole('tablist', { name: /Modo de transporte/i })
    expect(tablist).toBeInTheDocument()

    const walkTab = screen.getByRole('tab', { name: /Caminando/i })
    const driveTab = screen.getByRole('tab', { name: /En Carro/i })

    expect(walkTab).toHaveAttribute('aria-selected', 'true')
    expect(walkTab).toHaveAttribute('aria-controls', 'panel-walk')
    expect(driveTab).toHaveAttribute('aria-selected', 'false')
    expect(driveTab).toHaveAttribute('aria-controls', 'panel-drive')

    expect(screen.getByRole('tabpanel', { name: /Caminando/i })).toHaveAttribute('id', 'panel-walk')
  })

  it('populates location inputs with initial lat/lng props', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    expect(screen.getByLabelText(/Latitud/i)).toHaveValue(4.656)
    expect(screen.getByLabelText(/Longitud/i)).toHaveValue(-74.056)
  })

  it('updates location and keeps the score visible after clicking Actualizar Ubicación', async () => {
    const user = userEvent.setup()
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    const latInput = screen.getByLabelText(/Latitud/i)
    const lngInput = screen.getByLabelText(/Longitud/i)

    await user.clear(latInput)
    await user.type(latInput, '4.7')
    await user.clear(lngInput)
    await user.type(lngInput, '-74.1')

    await user.click(screen.getByRole('button', { name: /Actualizar Ubicación/i }))

    expect(latInput).toHaveValue(4.7)
    expect(lngInput).toHaveValue(-74.1)
    expect(screen.getByText(/Puntaje General/i)).toBeInTheDocument()
  })

  it('shows a validation error for non-numeric input', async () => {
    const user = userEvent.setup()
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    const latInput = screen.getByLabelText(/Latitud/i)
    fireEvent.change(latInput, { target: { value: 'abc' } })

    await user.click(screen.getByRole('button', { name: /Actualizar Ubicación/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/números válidos/i)
  })

  it('shows a validation error for out-of-range input', async () => {
    const user = userEvent.setup()
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    const latInput = screen.getByLabelText(/Latitud/i)
    await user.clear(latInput)
    await user.type(latInput, '100')

    await user.click(screen.getByRole('button', { name: /Actualizar Ubicación/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/latitud debe estar entre -90 y 90/i)
  })

  it('exposes aria-busy on the update button', async () => {
    render(<Widget lat={4.656} lng={-74.056} />)
    await screen.findByText(/Puntaje General/i)

    const button = screen.getByRole('button', { name: /Actualizar Ubicación/i })
    expect(button).toHaveAttribute('aria-busy', 'false')
  })
})
