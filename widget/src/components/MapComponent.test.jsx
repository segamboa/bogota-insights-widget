import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import MapComponent from './MapComponent'

describe('MapComponent', () => {
  it('renders without crashing', () => {
    const { container } = render(<MapComponent lat={4.656} lng={-74.056} />)
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
  })

  it('renders POI markers when data is provided', () => {
    const data = {
      pois: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.056, 4.656] },
            properties: { amenity: 'restaurant', name: 'Test Cafe' },
          },
        ],
      },
    }
    const { container } = render(<MapComponent lat={4.656} lng={-74.056} data={data} activeTab="walk" />)
    expect(container.querySelector('.leaflet-marker-icon')).toBeInTheDocument()
  })
})
