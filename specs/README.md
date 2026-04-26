# Specifications - Bogotá Insights Widget

**Metodología:** Specification-Driven Development (SDD)

## 📚 Documentos

| Documento | Descripción | Status |
|-----------|-------------|--------|
| [SDD-RUNBOOK.md](./SDD-RUNBOOK.md) | Guía completa de SDD para este proyecto | 📖 Start here |
| [SPEC-ETL-v1.0.md](./SPEC-ETL-v1.0.md) | Especificaciones del pipeline ETL | ✅ Foundation |

## 🎯 Quick Reference

### Verificar ETL
```bash
cd packages/api
npm run verify:etl
```

### Pipeline Completo
```bash
npm run pipeline  # migrate + ingest + verify
```

### Estructura de Specs

```
specs/
├── SPEC-XXX-title.md       # Especificación detallada
├── SDD-RUNBOOK.md          # Guía de metodología
└── README.md               # Este archivo
```

## 📝 Formatos de Spec

### Template para nuevas specs

```markdown
# SPEC-XXX: Título

**Status:** 📝 Draft / ✅ Implemented / 🚧 In Progress  
**Priority:** P0 (Critical) / P1 (High) / P2 (Medium) / P3 (Low)  
**Owner:** Nombre

## 1. Objetivo
Descripción de qué hace esta especificación.

## 2. Requisitos Funcionales

### FR-XXX.1: Nombre del requisito
**Input:** Qué recibe  
**Output:** Qué debe producir  
**Error:** Cómo manejar errores

## 3. Requisitos No Funcionales

### NFR-XXX.1: Rendimiento
**Tiempo:** < X segundos  
**Memoria:** < X MB

## 4. Casos de Prueba

| ID | Caso | Input | Output |
|----|------|-------|--------|
| TC-XXX.1 | Caso válido | X | Y |
| TC-XXX.2 | Error | X | Error Z |

## 5. Thresholds de Aceptación

| Métrica | Mínimo | Óptimo | Crítico |
|---------|--------|--------|---------|
| metric | 100 | 200 | 50 |
```

## 🗂️ Specs Roadmap

### Foundation (ETL) - ✅ Actual
- SPEC-001: IDECA Ingest
- SPEC-002: OSM Ingest
- SPEC-003: TransMilenio Ingest
- SPEC-004: Sync Runs
- SPEC-005: Verification Script

### Knowledge Base (Próximo)
- SPEC-006: Knowledge Base Schema
- SPEC-007: Embeddings Generation
- SPEC-008: LLM Integration

### Graph Database (Futuro)
- SPEC-009: Neo4j Schema
- SPEC-010: Barrio Relationships
- SPEC-011: Pathfinding Queries

---

*Specs mantenidas con SDD - v1.0*