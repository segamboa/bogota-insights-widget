# Bogota Insights Widget

An embeddable neighborhood insights widget for real estate listings in Bogota, Colombia.

## 🏗️ Project Structure

```
bogota-insights-widget/
├── packages/
│   ├── widget/          # Frontend (Preact + Web Component)
│   ├── api/             # Backend API (Fastify)
│   └── shared/          # Shared types and constants
├── jobs/                # Background data sync jobs
├── docs/                # Documentation
└── .github/workflows/   # CI/CD
```

## 📦 Monorepo Setup

This project uses:
- **pnpm** for package management
- **Turborepo** for build orchestration
- **TypeScript** across all packages

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 8+
- PostgreSQL 14+ with PostGIS extension
- Redis 7+

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp packages/api/.env.example packages/api/.env
# Edit .env with your configuration

# Run database migrations
cd packages/api && pnpm run migrate

# Start development servers
pnpm dev
```

This will start:
- Widget dev server at http://localhost:5173
- API server at http://localhost:3000

## 📚 Package Details

### @bogota-insights/widget
Preact-based web component that embeds into any website.

**Tech:** Preact, Web Components, Shadow DOM, Vite

### @bogota-insights/api
Fastify REST API serving neighborhood insights.

**Tech:** Fastify, PostgreSQL/PostGIS, Redis, Zod

### @bogota-insights/shared
Shared TypeScript types and constants.

## 🗂️ Data Sources

- **IDECA** - Official Bogota geospatial data
- **TransMilenio** - Public transit GTFS data
- **OpenStreetMap** - Supplementary POI data

## 📖 Documentation

See `/docs` folder for:
- [UX Design Specification](../docs/ux-design-spec.md)
- [Technical Architecture](../technical-architecture.md)
- [Data Validation Results](../data-validation-results.md)
- [Colombian Data Sources Research](../colombian-data-sources-research.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

## 📦 Building

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/widget && pnpm build
```

## 🚢 Deployment

See [Technical Architecture](../technical-architecture.md) for deployment strategy.

Recommended stack:
- Railway/Render for API + Database
- Upstash for Redis
- Cloudflare CDN for widget assets

## 📄 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. Contact the maintainers for access.

## ⚠️ Important Notes

- **Data Quality:** OSM has significant gaps in lower-estrato areas. IDECA is the primary source.
- **Colombian Law:** Complies with Ley 1581 de 2012 (data protection) and Ley 1712 de 2014 (transparency).
- **Estrato Sensitivity:** Be careful not to reinforce socioeconomic discrimination in scoring/presentation.

## 📞 Support

Contact: [your-email@example.com]
