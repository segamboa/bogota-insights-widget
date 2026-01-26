import React, { useEffect, useState } from 'react';
import MapComponent from './components/MapComponent';
import { calculateScores } from './utils/scoring';

const Widget = ({ lat, lng }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('walk'); // 'walk' or 'drive'

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Ensure data is only fetched once if possible in a real app (memoize or context)
                // For now, simple fetch
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

                const loadedData = { pois, primaryRoads, secondaryRoads, hospEscEntret, publicTransport };
                setData(loadedData);

                const calculation = calculateScores({ lat, lng }, loadedData);
                setResults(calculation);

            } catch (err) {
                console.error(err);
                setError('Failed to load spatial data.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [lat, lng]);

    useEffect(() => {
        if (data && lat && lng) {
            const calculation = calculateScores({ lat, lng }, data);
            setResults(calculation);
        }
    }, [lat, lng, data]);

    if (loading) return <div className="re-widget"><div className="loading-overlay">Cargando datos de Bogotá...</div></div>;
    if (error) return <div className="re-widget"><div className="loading-overlay" style={{ color: 'var(--danger)' }}>{error}</div></div>;
    if (!results) return null;

    const getScoreColor = (score) => {
        if (score >= 8) return 'var(--success)';
        if (score >= 5) return 'var(--warning)';
        return 'var(--danger)';
    };

    const currentScores = activeTab === 'walk' ? results.scores.walking : results.scores.driving;
    const currentInsights = results.insights.filter(i => activeTab === 'walk' ? (i.type === 'walk' || i.type === 'transport') : i.type === 'drive');

    return (
        <div className="re-widget">
            <div className="widget-visuals">
                <MapComponent lat={lat} lng={lng} />
            </div>

            <div className="widget-sidebar">

                {/* Header / Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                    <button
                        onClick={() => setActiveTab('walk')}
                        style={{
                            flex: 1, padding: '1rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: 600, borderBottom: activeTab === 'walk' ? '2px solid var(--primary-color)' : 'none',
                            color: activeTab === 'walk' ? 'var(--primary-color)' : 'var(--text-secondary)'
                        }}
                    >
                        🚶 Caminando (500m)
                    </button>
                    <button
                        onClick={() => setActiveTab('drive')}
                        style={{
                            flex: 1, padding: '1rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: 600, borderBottom: activeTab === 'drive' ? '2px solid var(--primary-color)' : 'none',
                            color: activeTab === 'drive' ? 'var(--primary-color)' : 'var(--text-secondary)'
                        }}
                    >
                        🚗 En Carro (3km)
                    </button>
                </div>

                {/* Global Score for Tab */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 800, color: getScoreColor(currentScores.total), lineHeight: 1 }}>
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
                            <span className="score-value" style={{ color: getScoreColor(results.scores.transport) }}>{results.scores.transport}/10</span>
                        </div>
                        <div className="score-bar-bg">
                            <div
                                className="score-bar-fill"
                                style={{ width: `${results.scores.transport * 10}%`, backgroundColor: getScoreColor(results.scores.transport) }}
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
    );
};

export default Widget;
