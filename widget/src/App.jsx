import React from 'react'
import Widget from './Widget'

function App() {
    // Example coordinates (Bogota center-ish or a specific house)
    // Calle 37 #13A-26 from the inspection earlier seemed to be a POI, let's use a nearby point.
    // 4.63 (lat), -74.08 (lng) approx for Bogota.
    // We'll default to a location to show the widget working.
    const testLocation = {
        lat: 4.656,
        lng: -74.056 // Near Virrey/Andino approx
    }

    return (
        <div className="app-container">
            <h1>Real Estate Assessment Widget</h1>
            <Widget lat={testLocation.lat} lng={testLocation.lng} />
        </div>
    )
}

export default App
