import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import MapComponent from './components/MapComponent';
import { calculateScores } from './utils/scoring';

const Widget = ({ lat, lng }) => {
    const [loading, setLoading] = useState(true);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('walk'); // 'walk' or 'drive'

    const [currentLat, setCurrentLat] = useState(lat);
    const [currentLng, setCurrentLng] = useState(lng);
    const [inputLat, setInputLat] = useState(String(lat));
    const [inputLng, setInputLng] = useState(String(lng));
    const [validationError, setValidationError] = useState(null);

    const dataRef = useRef(null);

    // Sync internal coordinates when the props change.
    useEffect(() => {
        setCurrentLat(lat);
        setCurrentLng(lng);
        setInputLat(String(lat));
        setInputLng(String(lng));
    }, [lat, lng]);

    // Fetch spatial data once and recalculate scores whenever the location changes.
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setIsRecalculating(true);
            setError(null);

            try {
                if (!dataRef.current) {
                    setLoading(true);

                    const [poisRes, primRes, secRes, heRes, tpRes] = await Promise.all([
                        fetch('/data/pois.geojson'),
                        fetch('/data/vias_primarias.geojson'),
                        fetch('/data/vias_secundarias.geojson'),
                        fetch('/data/hosp_esc_entret.geojson'),
                        fetch('/data/transporte_publico.geojson')
                    ]);

                    if (!poisRes.ok || !primRes.ok || !secRes.ok || !heRes.ok || !tpRes.ok) {
                        throw new Error('Error loading map data');
                    }

                    const pois = await poisRes.json();
                    const primaryRoads = await primRes.json();
                    const secondaryRoads = await secRes.json();
                    const hospEscEntret = await heRes.json();
                    const publicTransport = await tpRes.json();

                    dataRef.current = {
                        pois,
                        primaryRoads,
                        secondaryRoads,
                        hospEscEntret,
                        publicTransport
                    };
                }

                const calculation = calculateScores(
                    { lat: currentLat, lng: currentLng },
                    dataRef.current
                );

                if (cancelled) return;
                setResults(calculation);
            } catch (err) {
                if (cancelled) return;
                console.error(err);
                setError(
                    dataRef.current
                        ? 'Error al calcular los puntajes.'
                        : 'No se pudieron cargar los datos espaciales.'
                );
                setResults(null);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    setIsRecalculating(false);
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [currentLat, currentLng]);

    const handleUpdateLocation = () => {
        const parsedLat = parseFloat(inputLat);
        const parsedLng = parseFloat(inputLng);

        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
            setValidationError('Latitud y longitud deben ser números válidos.');
            return;
        }

        if (parsedLat < -90 || parsedLat > 90) {
            setValidationError('La latitud debe estar entre -90 y 90.');
            return;
        }

        if (parsedLng < -180 || parsedLng > 180) {
            setValidationError('La longitud debe estar entre -180 y 180.');
            return;
        }

        setValidationError(null);
        setCurrentLat(parsedLat);
        setCurrentLng(parsedLng);
    };

    if (loading) {
        return (
            <div className="re-widget">
                <div className="loading-overlay">Cargando datos de Bogotá...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="re-widget">
                <div className="loading-overlay" style={{ color: 'var(--danger)' }}>
                    {error}
                </div>
            </div>
        );
    }

    const getScoreColor = (score) => {
        if (score >= 8) return 'var(--success)';
        if (score >= 5) return 'var(--warning)';
        return 'var(--danger)';
    };

    if (!results) {
        return (
            <div className="re-widget">
                <div className="loading-overlay">
                    No se pudieron calcular los puntajes. Verifica los datos e intenta de nuevo.
                </div>
            </div>
        );
    }

    const currentScores = activeTab === 'walk' ? results.scores.walking : results.scores.driving;
    const currentInsights = results.insights.filter((i) =>
        activeTab === 'walk' ? i.type === 'walk' || i.type === 'transport' : i.type === 'drive'
    );

    return (
        <div className="re-widget">
            <div className="widget-visuals">
                <MapComponent lat={currentLat} lng={currentLng} />
            </div>

            <div className="widget-sidebar">
                {/* Header / Tabs */}
                <div
                    role="tablist"
                    aria-label="Modo de transporte"
                    style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}
                >
                    <button
                        id="tab-walk"
                        role="tab"
                        aria-selected={activeTab === 'walk'}
                        aria-controls="panel-walk"
                        onClick={() => setActiveTab('walk')}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            borderBottom: activeTab === 'walk' ? '2px solid var(--primary-color)' : 'none',
                            color: activeTab === 'walk' ? 'var(--primary-color)' : 'var(--text-secondary)'
                        }}
                    >
                        🚶 Caminando (500m)
                    </button>
                    <button
                        id="tab-drive"
                        role="tab"
                        aria-selected={activeTab === 'drive'}
                        aria-controls="panel-drive"
                        onClick={() => setActiveTab('drive')}
                        style={{
                            flex: 1,
                            padding: '1rem',
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            borderBottom: activeTab === 'drive' ? '2px solid var(--primary-color)' : 'none',
                            color: activeTab === 'drive' ? 'var(--primary-color)' : 'var(--text-secondary)'
                        }}
                    >
                        🚗 En Carro (3km)
                    </button>
                </div>

                {/* Editable Location */}
                <div
                    style={{
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem'
                    }}
                >
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                            <label htmlFor="lat-input" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Latitud
                            </label>
                            <input
                                id="lat-input"
                                type="number"
                                value={inputLat}
                                onChange={(e) => setInputLat(e.target.value)}
                                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '120px' }}>
                            <label htmlFor="lng-input" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                Longitud
                            </label>
                            <input
                                id="lng-input"
                                type="number"
                                value={inputLng}
                                onChange={(e) => setInputLng(e.target.value)}
                                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                            />
                        </div>
                        <button
                            onClick={handleUpdateLocation}
                            disabled={isRecalculating}
                            aria-busy={isRecalculating}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: 'var(--primary-color)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: isRecalculating ? 'not-allowed' : 'pointer',
                                opacity: isRecalculating ? 0.7 : 1
                            }}
                        >
                            Actualizar Ubicación
                        </button>
                    </div>
                    {validationError && (
                        <div role="alert" style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            {validationError}
                        </div>
                    )}
                </div>

                {/* Score content for the active tab */}
                <div
                    role="tabpanel"
                    id={`panel-${activeTab}`}
                    aria-labelledby={`tab-${activeTab}`}
                >
                    {/* Global Score for Tab */}
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div
                            aria-label={`Puntaje general: ${currentScores.total} de 10`}
                            style={{
                                fontSize: '3rem',
                                fontWeight: 800,
                                color: getScoreColor(currentScores.total),
                                lineHeight: 1
                            }}
                        >
                            {currentScores.total}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            Puntaje General ({activeTab === 'walk' ? 'Peatonal' : 'Vehicular'})
                        </div>
                    </div>

                    {/* Detailed Scores */}
                    {Object.entries(currentScores.details).map(([key, score]) => (
                        <div key={key} className="score-card">
                            <div className="score-header">
                                <span className="score-title" style={{ textTransform: 'capitalize' }}>
                                    {key === 'transport' ? 'Transporte Público' :
                                        key === 'education' ? 'Educación' :
                                            key === 'daily' ? 'Abastecimiento' :
                                                key === 'lifestyle' ? 'Estilo de Vida' :
                                                    key === 'health' ? 'Salud' :
                                                        key === 'university' ? 'Universidades' :
                                                            key === 'entertainment' ? 'Entretenimiento' : key}
                                </span>
                                <span className="score-value" style={{ color: getScoreColor(score) }}>{score}/10</span>
                            </div>
                            <div className="score-bar-bg">
                                <div
                                    className="score-bar-fill"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={10}
                                    aria-valuenow={score}
                                    style={{
                                        width: `${score * 10}%`,
                                        backgroundColor: getScoreColor(score)
                                    }}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Extra Transport Score - Moved to Drive tab */}
                    {activeTab === 'drive' && (
                        <div className="score-card">
                            <div className="score-header">
                                <span className="score-title">Conectividad Vial</span>
                                <span className="score-value" style={{ color: getScoreColor(results.scores.transport) }}>
                                    {results.scores.transport}/10
                                </span>
                            </div>
                            <div className="score-bar-bg">
                                <div
                                    className="score-bar-fill"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={10}
                                    aria-valuenow={results.scores.transport}
                                    style={{
                                        width: `${results.scores.transport * 10}%`,
                                        backgroundColor: getScoreColor(results.scores.transport)
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '2rem' }}>
                        <h3>Destacados</h3>
                        <ul className="insight-list">
                            {currentInsights.map((insight, idx) => (
                                <li key={idx} className="insight-item">
                                    <span style={{ color: 'var(--primary-color)' }}>•</span>
                                    <b>{insight.category}:</b> {insight.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

Widget.propTypes = {
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
};

export default Widget;
